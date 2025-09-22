// controllers/gamificacionController.js
import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ----------------- ASIGNAR LOGROS -----------------
export const asignarLogro = async (req, res) => {
  try {
    const { id_usuario, id_logro } = req.body;
    if (!id_usuario || !id_logro) return errorResponse(res, "Faltan datos", 400);

    await pool.query(
      `INSERT INTO UsuarioLogro (id_usuario, id_logro) 
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id_usuario, id_logro]
    );

    await registrarAuditoria(req.user.id_usuario, `Asignó logro ${id_logro} a usuario ${id_usuario}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, [], "Logro asignado");
  } catch (err) {
    console.error("Error en asignarLogro:", err);
    return errorResponse(res, "Error al asignar logro: " + err.message, 500);
  }
};

// ----------------- CREAR RANGO -----------------
export const crearRango = async (req, res) => {
  try {
    const { nombre, nivel, xp_minimo } = req.body;
    if (!nombre || nivel === undefined || xp_minimo === undefined) {
      return errorResponse(res, "Datos incompletos", 400);
    }

    const result = await pool.query(
      `INSERT INTO Rango (nombre, nivel, xp_minimo) VALUES ($1,$2,$3) RETURNING *`,
      [nombre, nivel, xp_minimo]
    );

    await registrarAuditoria(req.user.id_usuario, `Creó rango ${nombre}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, result.rows[0] || {}, "Rango creado");
  } catch (err) {
    console.error("Error en crearRango:", err);
    return errorResponse(res, "Error al crear rango: " + err.message, 500);
  }
};

// ----------------- CREAR TEMPORADA -----------------
export const crearTemporada = async (req, res) => {
  try {
    const { nombre, fecha_inicio, fecha_fin } = req.body;
    if (!nombre) return errorResponse(res, "Nombre de temporada requerido", 400);

    const result = await pool.query(
      `INSERT INTO Temporada (nombre, fecha_inicio, fecha_fin) VALUES ($1,$2,$3) RETURNING *`,
      [nombre, fecha_inicio || null, fecha_fin || null]
    );

    await registrarAuditoria(req.user.id_usuario, `Creó temporada ${nombre}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, result.rows[0] || {}, "Temporada creada");
  } catch (err) {
    console.error("Error en crearTemporada:", err);
    return errorResponse(res, "Error al crear temporada: " + err.message, 500);
  }
};

// ----------------- COMPLETAR MISIÓN -----------------
export const completarMision = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario, id_mision } = req.body;
    if (!id_usuario || !id_mision) return errorResponse(res, "Faltan datos", 400);

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO MisionUsuario (id_usuario, id_mision, estado) 
       VALUES ($1,$2,'completada')
       ON CONFLICT (id_usuario,id_mision) DO UPDATE SET estado='completada'`,
      [id_usuario, id_mision]
    );

    const mision = await client.query(
      `SELECT xp_recompensa, monedas_recompensa, gemas_recompensa 
       FROM Mision WHERE id_mision=$1`,
      [id_mision]
    );

    const { xp_recompensa = 0, monedas_recompensa = 0, gemas_recompensa = 0 } = mision.rows[0] || {};

    const usuario = await client.query(
      `UPDATE Usuario
       SET xp = xp + $2, monedas = monedas + $3, gemas = gemas + $4
       WHERE id_usuario = $1
       RETURNING id_usuario, nombre, xp, monedas, gemas`,
      [id_usuario, xp_recompensa, monedas_recompensa, gemas_recompensa]
    );

    await client.query("COMMIT");

    await validarLogrosInterno(id_usuario);

    await registrarAuditoria(req.user.id_usuario, `Usuario ${id_usuario} completó misión ${id_mision}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, usuario.rows[0] || {}, "Misión completada y XP asignado");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en completarMision:", err);
    return errorResponse(res, "Error al completar misión: " + err.message, 500);
  } finally {
    client.release();
  }
};

// ----------------- ASIGNAR PUNTOS EN TEMPORADA -----------------
export const asignarPuntosTemporada = async (req, res) => {
  try {
    const { id_temporada, id_usuario, puntos } = req.body;
    if (!id_temporada || !id_usuario || puntos === undefined) {
      return errorResponse(res, "Datos incompletos", 400);
    }

    await pool.query(
      `INSERT INTO RankingTemporada (id_temporada, id_usuario, puntos) 
       VALUES ($1,$2,$3)
       ON CONFLICT (id_temporada,id_usuario) 
       DO UPDATE SET puntos = RankingTemporada.puntos + $3`,
      [id_temporada, id_usuario, puntos]
    );

    await registrarAuditoria(req.user.id_usuario, `Asignó ${puntos} puntos a usuario ${id_usuario} en temporada ${id_temporada}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, [], "Puntos asignados");
  } catch (err) {
    console.error("Error en asignarPuntosTemporada:", err);
    return errorResponse(res, "Error al asignar puntos: " + err.message, 500);
  }
};

// ----------------- CREAR RECOMPENSA -----------------
export const crearRecompensaTemporada = async (req, res) => {
  try {
    const { id_temporada, descripcion, tipo, valor } = req.body;
    if (!id_temporada || !descripcion) return errorResponse(res, "Datos incompletos", 400);

    const result = await pool.query(
      `INSERT INTO RecompensaTemporada (id_temporada, descripcion, tipo, valor)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id_temporada, descripcion, tipo || null, valor || 0]
    );

    await registrarAuditoria(req.user.id_usuario, `Creó recompensa para temporada ${id_temporada}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, result.rows[0] || {}, "Recompensa creada");
  } catch (err) {
    console.error("Error en crearRecompensaTemporada:", err);
    return errorResponse(res, "Error al crear recompensa: " + err.message, 500);
  }
};

// ----------------- LISTAR LOGROS DE UN USUARIO -----------------
export const listarLogrosUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const result = await pool.query(
      `SELECT l.* FROM UsuarioLogro ul 
       JOIN Logro l ON ul.id_logro = l.id_logro
       WHERE ul.id_usuario=$1`,
      [id_usuario]
    );

    return successResponse(res, result.rows || []);
  } catch (err) {
    console.error("Error en listarLogrosUsuario:", err);
    return errorResponse(res, "Error al listar logros: " + err.message, 500);
  }
};

// ----------------- ASIGNAR XP/MONEDAS/GEMAS -----------------
export const asignarRecursos = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario, xp = 0, monedas = 0, gemas = 0 } = req.body;
    if (!id_usuario) return errorResponse(res, "Falta id_usuario", 400);

    await client.query("BEGIN");

    // Obtener estado actual del usuario
    const usuarioActual = await client.query(
      "SELECT xp, monedas, gemas FROM Usuario WHERE id_usuario=$1 FOR UPDATE",
      [id_usuario]
    );
    if (!usuarioActual.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    const { xp: xpPrev, monedas: monedasPrev, gemas: gemasPrev } = usuarioActual.rows[0];

    // Actualizar recursos
    const result = await client.query(
      `UPDATE Usuario 
       SET xp = xp + $2, monedas = monedas + $3, gemas = gemas + $4
       WHERE id_usuario = $1 
       RETURNING id_usuario, nombre, xp, monedas, gemas`,
      [id_usuario, xp, monedas, gemas]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Asignó recursos a usuario ${id_usuario}`,
      "UPDATE",
      "Usuario",
      id_usuario,
      {
        recursos_anteriores: { xp: xpPrev, monedas: monedasPrev, gemas: gemasPrev },
        recursos_asignados: { xp, monedas, gemas },
        recursos_nuevos: result.rows[0]
      },
      req.ip,
      req.headers["user-agent"]
    );

    await client.query("COMMIT");

    return successResponse(res, result.rows[0] || {}, "Recursos asignados correctamente");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en asignarRecursos:", err);
    return errorResponse(res, "Error al asignar recursos: " + err.message, 500);
  } finally {
    client.release();
  }
};



// ----------------- LISTAR USUARIOS CONQUISTADORES -----------------
export const listarUsuariosConquistadores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.xp, u.monedas, u.gemas
       FROM Usuario u
       JOIN UsuarioRol ur ON u.id_usuario = ur.id_usuario
       JOIN Rol r ON ur.id_rol = r.id_rol
       WHERE r.nombre ILIKE 'Conquistador'
       AND u.activo = true
       ORDER BY u.nombre ASC`
    );

    return successResponse(res, result.rows || []);
  } catch (err) {
    console.error("Error en listarUsuariosConquistadores:", err);
    return errorResponse(res, "Error al listar usuarios conquistadores: " + err.message, 500);
  }
};

// ----------------- LISTAR UNIDADES CON USUARIOS -----------------
export const listarUnidadesConquistadores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        un.id_unidad,
        un.nombre AS nombre_unidad,
        u.id_usuario,
        u.nombre AS nombre_usuario,
        u.email,
        u.xp,
        u.monedas,
        u.gemas
       FROM Unidad un
       JOIN UnidadUsuario uu ON un.id_unidad = uu.id_unidad
       JOIN Usuario u ON uu.id_usuario = u.id_usuario
       JOIN UsuarioRol ur ON u.id_usuario = ur.id_usuario
       JOIN Rol r ON ur.id_rol = r.id_rol
       WHERE r.nombre ILIKE 'Conquistador'
       AND u.activo = true
       ORDER BY un.nombre ASC, u.nombre ASC`
    );

    const unidadesMap = {};
    (result.rows || []).forEach(row => {
      if (!unidadesMap[row.id_unidad]) {
        unidadesMap[row.id_unidad] = {
          id_unidad: row.id_unidad,
          nombre_unidad: row.nombre_unidad,
          usuarios: []
        };
      }
      unidadesMap[row.id_unidad].usuarios.push({
        id_usuario: row.id_usuario,
        nombre: row.nombre_usuario,
        email: row.email,
        xp: row.xp,
        monedas: row.monedas,
        gemas: row.gemas
      });
    });

    return successResponse(res, Object.values(unidadesMap) || []);
  } catch (err) {
    console.error("Error en listarUnidadesConquistadores:", err);
    return errorResponse(res, "Error al listar unidades conquistadoras: " + err.message, 500);
  }
};

export const rankingGeneral = async (req, res) => {
  try {
    const { limite = 10 } = req.query;

    const result = await pool.query(
      `SELECT 
         u.id_usuario,
         u.nombre,
         u.email,
         u.xp,
         u.monedas,
         u.gemas,
         COUNT(mu.id_mision) FILTER (WHERE mu.estado='completada') AS misiones_completadas
       FROM Usuario u
       LEFT JOIN MisionUsuario mu ON u.id_usuario = mu.id_usuario
       WHERE u.activo = true
         AND u.rol <> 'administrador'
       GROUP BY u.id_usuario, u.nombre, u.email, u.xp, u.monedas, u.gemas
       ORDER BY u.xp DESC, misiones_completadas DESC
       LIMIT $1`,
      [limite]
    );

    return successResponse(res, result.rows || [], "Ranking general actualizado");
  } catch (err) {
    console.error("Error en rankingGeneral:", err);
    return errorResponse(res, "Error al obtener ranking general: " + err.message, 500);
  }
};


// ---------------------- RANKING POR UNIDAD ----------------------
export const rankingPorUnidad = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          u.id_unidad,
          u.nombre AS nombre_unidad,
          COUNT(mu.id_mision) AS misiones_completadas
       FROM unidad u
       JOIN unidadusuario uu ON u.id_unidad = uu.id_unidad
       JOIN usuario usr ON uu.id_usuario = usr.id_usuario AND usr.activo = true
       LEFT JOIN misionusuario mu 
           ON mu.id_usuario = usr.id_usuario AND mu.estado = 'completada'
       GROUP BY u.id_unidad, u.nombre
       ORDER BY misiones_completadas DESC
       LIMIT 10`
    );

    if (!result.rows.length) {
      return successResponse(res, [], "No hay unidades con misiones completadas");
    }

    return successResponse(res, result.rows, "Ranking por unidad actualizado");
  } catch (err) {
    console.error("Error en rankingPorUnidad:", err);
    return errorResponse(res, "Error al obtener ranking por unidad: " + err.message, 500);
  }
};


// ----------------- CERRAR TEMPORADA -----------------
export const cerrarTemporada = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_temporada } = req.body;
    if (!id_temporada) return errorResponse(res, "Falta id_temporada", 400);

    await client.query("BEGIN");

    const usuarios = await client.query(
      `SELECT u.id_usuario, u.xp
       FROM Usuario u
       JOIN UsuarioRol ur ON u.id_usuario = ur.id_usuario
       JOIN Rol r ON ur.id_rol = r.id_rol
       WHERE r.nombre ILIKE 'Conquistador'`
    );

    for (let user of usuarios.rows || []) {
      await client.query(
        `INSERT INTO RankingTemporada (id_temporada, id_usuario, puntos)
         VALUES ($1,$2,$3)
         ON CONFLICT (id_temporada,id_usuario) DO UPDATE SET puntos=$3`,
        [id_temporada, user.id_usuario, user.xp]
      );
    }

    const top = await client.query(
      `SELECT id_usuario, xp
       FROM Usuario
       ORDER BY xp DESC
       LIMIT 3`
    );

    let posicion = 1;
    for (let row of top.rows || []) {
      await client.query(
        `INSERT INTO RecompensaTemporada (id_temporada, descripcion, tipo, valor)
         VALUES ($1,$2,$3,$4)`,
        [id_temporada, `Premio por posición ${posicion}`, "Monedas", (4 - posicion) * 100]
      );
      posicion++;
    }

    await client.query(
      `UPDATE Usuario 
       SET xp = 0, monedas = 0, gemas = 0
       WHERE id_usuario IN (
         SELECT u.id_usuario 
         FROM Usuario u
         JOIN UsuarioRol ur ON u.id_usuario = ur.id_usuario
         JOIN Rol r ON ur.id_rol = r.id_rol
         WHERE r.nombre ILIKE 'Conquistador'
       )`
    );

    await client.query("COMMIT");

    await registrarAuditoria(req.user.id_usuario, `Cerró temporada ${id_temporada}`, req.ip, req.headers["user-agent"]);
    return successResponse(res, [], "Temporada cerrada y ranking guardado");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en cerrarTemporada:", err);
    return errorResponse(res, "Error al cerrar temporada: " + err.message, 500);
  } finally {
    client.release();
  }
};

// ----------------- LISTAR TEMPORADAS -----------------
export const listarTemporadas = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id_temporada, t.nombre, t.fecha_inicio, t.fecha_fin,
              rt.id_usuario, u.nombre AS usuario_nombre, rt.puntos, rt.posicion
       FROM Temporada t
       LEFT JOIN RankingTemporada rt ON t.id_temporada = rt.id_temporada
       LEFT JOIN Usuario u ON rt.id_usuario = u.id_usuario
       ORDER BY t.id_temporada DESC, rt.puntos DESC`
    );

    const temporadasMap = {};
    (result.rows || []).forEach(row => {
      if (!temporadasMap[row.id_temporada]) {
        temporadasMap[row.id_temporada] = {
          id_temporada: row.id_temporada,
          nombre: row.nombre,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          rangos: []
        };
      }

      if (row.id_usuario) {
        temporadasMap[row.id_temporada].rangos.push({
          id_usuario: row.id_usuario,
          usuario_nombre: row.usuario_nombre,
          puntos: row.puntos,
          posicion: row.posicion
        });
      }
    });

    return successResponse(res, Object.values(temporadasMap) || []);
  } catch (err) {
    console.error("Error en listarTemporadas:", err);
    return errorResponse(res, "Error al listar temporadas: " + err.message, 500);
  }
};
