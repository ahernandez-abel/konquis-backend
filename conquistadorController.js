import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ----------------- LISTAR MISIONES ASIGNADAS AL USUARIO (INDIVIDUALES) -----------------
export const listarMisionesUsuario = async (req, res) => {
  try {
    const id_usuario = req.user?.id_usuario;
    if (!id_usuario) return errorResponse(res, "No se encontró id_usuario en token", 400);

    const resultUsuario = await pool.query(
      `SELECT mu.id_usuario, mu.id_mision, mu.estado, mu.intentos,
              mu.fecha_asignacion, mu.fecha_completada,
              m.nombre, m.descripcion, m.tipo, m.dificultad, m.xp, m.monedas, m.gemas,
              NULL AS unidad_nombre,
              'individual' AS tipo_mision
       FROM MisionUsuario mu
       LEFT JOIN Mision m ON m.id_mision = mu.id_mision
       WHERE mu.id_usuario = $1
         AND NOT EXISTS (
           SELECT 1
           FROM MisionUnidad muU
           WHERE muU.id_mision = mu.id_mision
         )
       ORDER BY mu.fecha_asignacion ASC`,
      [id_usuario]
    );

    return successResponse(res, { individuales: resultUsuario.rows || [] }, "Misiones individuales cargadas correctamente");
  } catch (error) {
    console.error("Error listarMisionesUsuario:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- LISTAR INSIGNIAS -----------------
export const listarInsignias = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const result = await pool.query(
      `SELECT i.id_insignia, i.nombre, i.descripcion, i.imagen, ui.fecha_obtenida
       FROM Insignia i
       INNER JOIN UsuarioInsignia ui ON ui.id_insignia = i.id_insignia
       WHERE ui.id_usuario = $1`,
      [id_usuario]
    );

    return successResponse(res, result.rows, "Insignias obtenidas");
  } catch (error) {
    console.error("Error listarInsignias:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- RANKING INDIVIDUAL GLOBAL -----------------
export const rankingIndividual = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nombre, xp, nivel
       FROM Usuario
       WHERE rol <> 'administrador'
       ORDER BY xp DESC, nivel DESC`
    );
    return successResponse(res, result.rows, "Ranking individual global obtenido");
  } catch (error) {
    console.error("Error rankingIndividual:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- RANKING POR UNIDAD (misiones completadas) -----------------
export const rankingUnidad = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id_unidad,
        u.nombre AS nombre_unidad,
        us.id_usuario,
        us.nombre AS nombre_usuario,
        COUNT(DISTINCT CASE
          WHEN mu.estado = 'completada' THEN mu.id_mision
        END) AS misiones_completadas
      FROM unidad u
      JOIN unidadusuario uu ON uu.id_unidad = u.id_unidad
      JOIN usuario us ON us.id_usuario = uu.id_usuario
        AND us.rol <> 'administrador'
      LEFT JOIN misionusuario mu
        ON mu.id_usuario = us.id_usuario
      LEFT JOIN misionunidad muu
        ON muu.id_unidad = u.id_unidad
      LEFT JOIN validacionmision v
        ON v.id_mision = muu.id_mision
        AND v.id_usuario = us.id_usuario
      GROUP BY u.id_unidad, u.nombre, us.id_usuario, us.nombre
      ORDER BY u.id_unidad, misiones_completadas DESC
    `);

    const unidadesMap = {};
    result.rows.forEach(row => {
      if (!unidadesMap[row.id_unidad]) {
        unidadesMap[row.id_unidad] = { id_unidad: row.id_unidad, nombre_unidad: row.nombre_unidad, ranking: [] };
      }
      unidadesMap[row.id_unidad].ranking.push({
        id_usuario: row.id_usuario,
        nombre: row.nombre_usuario,
        misiones_completadas: parseInt(row.misiones_completadas, 10)
      });
    });

    const unidades = Object.values(unidadesMap).sort((a, b) => {
      const totalA = a.ranking.reduce((acc, m) => acc + m.misiones_completadas, 0);
      const totalB = b.ranking.reduce((acc, m) => acc + m.misiones_completadas, 0);
      return totalB - totalA;
    });

    return successResponse(res, unidades, "Ranking por unidad obtenido");
  } catch (error) {
    console.error("Error rankingUnidad:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- INFORMACIÓN DE LA UNIDAD -----------------
export const infoUnidad = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const unidadResult = await pool.query(
      `SELECT un.id_unidad, un.nombre, d.id_usuario AS id_lider, d.nombre AS nombre_lider
       FROM Unidad un
       LEFT JOIN Usuario d ON d.id_usuario = un.id_directiva
       INNER JOIN UnidadUsuario uu ON uu.id_unidad = un.id_unidad
       WHERE uu.id_usuario = $1`,
      [id_usuario]
    );

    if (unidadResult.rows.length === 0) return successResponse(res, null, "No pertenece a ninguna unidad");

    const unidad = unidadResult.rows[0];

    const miembrosResult = await pool.query(
      `SELECT u.id_usuario, u.nombre
       FROM Usuario u
       INNER JOIN UnidadUsuario uu ON uu.id_usuario = u.id_usuario
       WHERE uu.id_unidad = $1
         AND u.rol <> 'administrador'`,
      [unidad.id_unidad]
    );

    unidad.miembros = miembrosResult.rows.map(miembro => ({
      id_usuario: miembro.id_usuario,
      nombre: miembro.nombre,
      esLider: miembro.id_usuario === unidad.id_lider
    }));

    return successResponse(res, unidad, "Información de unidad obtenida");
  } catch (error) {
    console.error("Error infoUnidad:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- LISTAR NOTIFICACIONES -----------------
export const listarNotificaciones = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const result = await pool.query(
      `SELECT id_notificacion, mensaje, leida, fecha
       FROM Notificacion
       WHERE id_usuario = $1
       ORDER BY fecha DESC`,
      [id_usuario]
    );

    return successResponse(res, result.rows, "Notificaciones obtenidas");
  } catch (error) {
    console.error("Error listarNotificaciones:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- RESUMEN DE TEMPORADA -----------------
export const resumenTemporada = async (req, res) => {
  const idUsuario = req.params.id_usuario || req.user.id_usuario;
  try {
    const result = await pool.query(`
      SELECT t.id_temporada,
             t.nombre,
             t.fecha_inicio,
             t.fecha_fin,
             COUNT(m.id_mision) AS misiones_asignadas,
             SUM(CASE WHEN mu.estado = 'completada' THEN 1 ELSE 0 END) AS misiones_completadas
      FROM Temporada t
      LEFT JOIN Mision m ON m.id_temporada = t.id_temporada
      LEFT JOIN MisionUnidad muU ON muU.id_mision = m.id_mision
      LEFT JOIN UnidadUsuario uu ON uu.id_unidad = muU.id_unidad AND uu.id_usuario = $1
      LEFT JOIN MisionUsuario mu ON mu.id_mision = m.id_mision AND mu.id_usuario = $1
      GROUP BY t.id_temporada
      ORDER BY t.fecha_inicio DESC
      LIMIT 1;
    `, [idUsuario]);

    await registrarAuditoria(req.user?.id_usuario || null, "Resumen Temporada", `Usuario consultó resumen de temporada`);

    return successResponse(res, result.rows, "Resumen de temporada cargado correctamente");
  } catch (err) {
    console.error("Error resumenTemporada:", err);
    return errorResponse(res, err.message, 500);
  }
};

// ----------------- PROGRESO DE NIVEL -----------------
export const progresoNivel = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const result = await pool.query(
      `SELECT xp, nivel, monedas, gemas
       FROM usuario
       WHERE id_usuario = $1`,
      [id_usuario]
    );

    if (!result.rows.length) {
      return errorResponse(res, "Usuario no encontrado");
    }

    const usuario = result.rows[0];

    // Calcular nivel real y XP restante
    let xpActual = usuario.xp;
    let nivel = 1;
    let xpParaSubir = 1000;

    while (xpActual >= xpParaSubir) {
      xpActual -= xpParaSubir;
      nivel++;
      xpParaSubir = Math.floor(xpParaSubir * 1.2);
    }

    return successResponse(res, {
      nivel,
      xpActual,
      xpMax: xpParaSubir,
      monedas: usuario.monedas,
      gemas: usuario.gemas
    }, "Progreso de nivel obtenido correctamente");

  } catch (error) {
    console.error("Error progresoNivel:", error);
    return errorResponse(res, error.message);
  }
};

// ----------------- SUBIR EVIDENCIA -----------------
export const subirEvidencia = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;
    const { id_mision, tipo, url_archivo } = req.body;
    let archivoPath = url_archivo || null;

    // Si hay archivo subido por multer, usar su path
    if (req.file) {
      archivoPath = `${req.file.destination}/${req.file.filename}`;
    }

    if (!id_mision || !tipo || !archivoPath) {
      return errorResponse(res, "Todos los campos son obligatorios", 400);
    }

    // Insertar en la tabla EvidenciaMision
    const result = await pool.query(
      `INSERT INTO EvidenciaMision (id_mision, id_usuario, tipo, url_archivo, fecha)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id_mision, id_usuario, tipo, archivoPath]
    );

    // Actualizar estado de la misión
    await pool.query(
      `UPDATE MisionUsuario
       SET estado = 'completada', fecha_completada = NOW()
       WHERE id_mision = $1 AND id_usuario = $2`,
      [id_mision, id_usuario]
    );

    return successResponse(res, result.rows[0], "Evidencia subida correctamente");
  } catch (error) {
    console.error("Error subirEvidencia:", error);
    return errorResponse(res, error.message, 500);
  }
};
// ----------------- LISTAR MISIONES DE UNIDAD DEL USUARIO -----------------
export const listarMisionesUnidadUsuario = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const unidades = await pool.query(
      `SELECT id_unidad FROM UnidadUsuario WHERE id_usuario=$1`,
      [id_usuario]
    );
    const unidadIds = unidades.rows.map(u => u.id_unidad);
    if (!unidadIds.length) return successResponse(res, [], "No pertenece a ninguna unidad");

    const result = await pool.query(
      `SELECT m.id_mision, m.nombre, m.descripcion, m.tipo, m.dificultad,
              m.xp, m.monedas, m.gemas,
              mu.estado, mu.intentos, mu.fecha_asignacion, mu.fecha_completada,
              u.id_unidad, u.nombre AS unidad_nombre,
              'unidad' AS tipo_mision
       FROM Mision m
       INNER JOIN MisionUnidad muU ON muU.id_mision = m.id_mision
       INNER JOIN Unidad u ON muU.id_unidad = u.id_unidad
       LEFT JOIN MisionUsuario mu ON mu.id_mision = m.id_mision AND mu.id_usuario = $1
       WHERE muU.id_unidad = ANY($2::int[])
       ORDER BY m.fecha_inicio DESC NULLS LAST`,
      [id_usuario, unidadIds]
    );

    const misionesUnidad = result.rows;
    return successResponse(res, misionesUnidad, "Misiones de unidad cargadas correctamente");
  } catch (err) {
    console.error("Error listarMisionesUnidadUsuario:", err);
    return errorResponse(res, err.message, 500);
  }
};
