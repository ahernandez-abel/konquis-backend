import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ---------------------- CREAR MISIÓN ----------------------
export const crearMision = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      nombre,
      descripcion,
      tipo,
      dificultad,
      xp,
      monedas,
      gemas,
      max_intentos,
      fecha_inicio,
      fecha_fin,
      asignados_usuarios = [],
      asignados_unidades = []
    } = req.body;

    await client.query("BEGIN");

    // 1️⃣ Crear misión
    const result = await client.query(
      `INSERT INTO Mision 
       (nombre, descripcion, tipo, dificultad, xp, monedas, gemas, max_intentos, fecha_inicio, fecha_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id_mision`,
      [nombre, descripcion, tipo, dificultad, xp, monedas, gemas, max_intentos, fecha_inicio, fecha_fin]
    );
    const id_mision = result.rows[0].id_mision;

    // 2️⃣ Asignar a usuarios individuales
    for (let u of asignados_usuarios) {
      if (!u) continue; // seguridad extra
      await client.query(
        `INSERT INTO MisionUsuario (id_mision, id_usuario, estado, intentos, fecha_asignacion)
         VALUES ($1,$2,'pendiente',0,NOW())
         ON CONFLICT (id_mision,id_usuario) DO NOTHING`,
        [id_mision, u]
      );
    }

    // 3️⃣ Asignar a unidades
    for (let un of asignados_unidades) {
      if (!un) continue;

      // Insertar registro en MisionUnidad
      await client.query(
        `INSERT INTO MisionUnidad (id_mision, id_unidad, fecha_asignacion)
         VALUES ($1,$2,NOW())
         ON CONFLICT (id_mision,id_unidad) DO NOTHING`,
        [id_mision, un]
      );

      // Obtener todos los usuarios de la unidad
      const usuariosUnidad = await client.query(
        `SELECT id_usuario FROM UnidadUsuario WHERE id_unidad=$1`,
        [un]
      );

      // Insertar la misión para cada usuario
      for (let u of usuariosUnidad.rows) {
        if (!u.id_usuario) continue;
        await client.query(
          `INSERT INTO MisionUsuario (id_mision, id_usuario, estado, intentos, fecha_asignacion)
           VALUES ($1,$2,'pendiente',0,NOW())
           ON CONFLICT (id_mision,id_usuario) DO NOTHING`,
          [id_mision, u.id_usuario]
        );
      }
    }

    await client.query("COMMIT");

    // Auditoría opcional
    await registrarAuditoria(
  req.user?.id || null,
  `Creó misión ${id_mision}`,
  "CREATE",
  "Mision",
  id_mision,
  {
    nombre,
    descripcion,
    tipo,
    dificultad,
    xp,
    monedas,
    gemas,
    max_intentos,
    fecha_inicio,
    fecha_fin,
    asignados_usuarios,
    asignados_unidades
  },
  req.ip,
  req.headers["user-agent"]
);

    return successResponse(res, { id_mision }, "Misión creada con éxito");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en crearMision:", error);
    return errorResponse(res, "Error al crear misión: " + error.message, 500);
  } finally {
    client.release();
  }
};
// ---------------------- EDITAR MISIÓN ----------------------
export const editarMision = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_mision } = req.params;
    const {
      nombre,
      descripcion,
      tipo,
      dificultad,
      xp,
      monedas,
      gemas,
      max_intentos,
      fecha_inicio,
      fecha_fin,
      activa,
      id_temporada,
      asignados_unidades
    } = req.body;

    const fechaInicioValida = fecha_inicio
      ? new Date(fecha_inicio).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const fechaFinValida = fecha_fin
      ? new Date(fecha_fin).toISOString().split("T")[0]
      : null;

    await client.query("BEGIN");

    await client.query(
      `UPDATE Mision
       SET nombre=$1,
           descripcion=$2,
           tipo=$3,
           dificultad=$4,
           xp=$5,
           monedas=$6,
           gemas=$7,
           max_intentos=$8,
           fecha_inicio=$9,
           fecha_fin=$10,
           activa=$11,
           id_temporada=$12
       WHERE id_mision=$13`,
      [
        nombre,
        descripcion || "",
        tipo,
        dificultad || "normal",
        xp || 0,
        monedas || 0,
        gemas || 0,
        max_intentos || 1,
        fechaInicioValida,
        fechaFinValida,
        activa !== undefined ? activa : true,
        id_temporada || null,
        id_mision
      ]
    );

    await client.query("DELETE FROM MisionUnidad WHERE id_mision=$1", [id_mision]);
    if (Array.isArray(asignados_unidades) && asignados_unidades.length > 0) {
      for (const id_unidad of asignados_unidades) {
        await client.query(
          "INSERT INTO MisionUnidad (id_mision, id_unidad) VALUES ($1,$2)",
          [id_mision, id_unidad]
        );
      }
    }

    await registrarAuditoria(
  req.user?.id || null,
  `Editó misión ${id_mision}`,
  "UPDATE",
  "Mision",
  id_mision,
  {
    nombre,
    descripcion,
    tipo,
    dificultad,
    xp,
    monedas,
    gemas,
    max_intentos,
    fecha_inicio: fechaInicioValida,
    fecha_fin: fechaFinValida,
    activa,
    id_temporada,
    asignados_unidades
  },
  req.ip,
  req.headers["user-agent"]
);

    await client.query("COMMIT");

    return successResponse(res, null, "Misión actualizada correctamente");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en editarMision:", err);
    return errorResponse(res, err.message, 500);
  } finally {
    client.release();
  }
};

// ---------------------- ASIGNAR MISIÓN ----------------------
export const asignarMision = async (req, res) => {
  try {
    const { id_mision, id_usuario, id_unidad } = req.body;

    if (!id_mision || (!id_usuario && !id_unidad))
      return errorResponse(res, "Se requiere id_mision y al menos id_usuario o id_unidad", 400);

    const usuariosAsignados = [];

    // Asignar misión a un usuario específico
    if (id_usuario) {
      // Opcional: verificar que no sea administrador antes de asignar
      const usuarioCheck = await pool.query(
        `SELECT rol FROM usuario WHERE id_usuario=$1`,
        [id_usuario]
      );
      if (usuarioCheck.rows[0]?.rol === 'administrador') {
        return errorResponse(res, "No se puede asignar misión a un administrador", 400);
      }

      await pool.query(
        `INSERT INTO MisionUsuario (id_mision, id_usuario, estado, intentos, fecha_asignacion)
         VALUES ($1, $2, 'pendiente', 0, NOW())
         ON CONFLICT (id_mision, id_usuario) DO NOTHING`,
        [id_mision, id_usuario]
      );
      usuariosAsignados.push(id_usuario);
    }

    // Asignar misión a todos los usuarios de una unidad
    if (id_unidad) {
      const usuarios = await pool.query(
        `SELECT u.id_usuario
         FROM UnidadUsuario uu
         INNER JOIN Usuario u ON uu.id_usuario = u.id_usuario
         WHERE uu.id_unidad = $1
           AND u.activo = true
           AND u.rol <> 'administrador'`, // <-- Excluir administradores
        [id_unidad]
      );

      for (let u of usuarios.rows) {
        await pool.query(
          `INSERT INTO MisionUsuario (id_mision, id_usuario, estado, intentos, fecha_asignacion)
           VALUES ($1, $2, 'pendiente', 0, NOW())
           ON CONFLICT (id_mision, id_usuario) DO NOTHING`,
          [id_mision, u.id_usuario]
        );
        usuariosAsignados.push(u.id_usuario);
      }
    }

    await registrarAuditoria(
  req.user?.id || null,
  `Asignó misión ${id_mision} a usuarios: [${usuariosAsignados.join(", ")}]` ,
  "UPDATE",
  "MisionUsuario",
  id_mision,
  { id_usuario, id_unidad, usuariosAsignados },
  req.ip,
  req.headers["user-agent"]
);


    return successResponse(res, { usuariosAsignados }, "Misión asignada correctamente");
  } catch (err) {
    console.error("Error en asignarMision:", err);
    return errorResponse(res, err.message, 500);
  }
};
// -------------------- VALIDAR MISIÓN --------------------
export const validarMision = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_mision, id_usuario, id_validador } = req.body;

    if (!Number.isInteger(id_mision) || !Number.isInteger(id_usuario) || !Number.isInteger(id_validador)) {
      return errorResponse(res, "id_mision, id_usuario y id_validador son obligatorios y deben ser números válidos", 400);
    }

    await client.query("BEGIN");

    // ------------------ DATOS DE LA MISIÓN ------------------
    const misionQuery = await client.query(
      "SELECT xp, monedas, gemas FROM mision WHERE id_mision=$1",
      [id_mision]
    );
    if (!misionQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Misión no encontrada", 404);
    }
    const { xp, monedas, gemas } = misionQuery.rows[0];

    // ------------------ USUARIO ------------------
    const usuarioQuery = await client.query(
      "SELECT id_usuario, xp, nivel, monedas, gemas FROM usuario WHERE id_usuario=$1 FOR UPDATE",
      [id_usuario]
    );
    if (!usuarioQuery.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "Usuario no encontrado", 404);
    }
    const usuario = usuarioQuery.rows[0];

    // ------------------ VALIDACIÓN EXISTENTE ------------------
    const validacionExistente = await client.query(
      "SELECT 1 FROM validacionmision WHERE id_mision=$1 AND id_usuario=$2",
      [id_mision, id_usuario]
    );
    if (validacionExistente.rows.length) {
      await client.query("ROLLBACK");
      return errorResponse(res, "La misión ya fue validada para este usuario", 400);
    }

    // ------------------ VERIFICAR SI ES MISIÓN DE UNIDAD ------------------
    const misionUnidadQuery = await client.query(
      `SELECT mu.id_unidad, u.id_directiva
       FROM misionunidad mu
       JOIN unidad u ON mu.id_unidad = u.id_unidad
       WHERE mu.id_mision=$1`,
      [id_mision]
    );

    if (!misionUnidadQuery.rows.length) {
      // ------------------ MISIÓN INDIVIDUAL ------------------
      const updateResult = await client.query(
        `UPDATE misionusuario
         SET estado='completada', intentos=intentos+1, fecha_completada=NOW()
         WHERE id_mision=$1 AND id_usuario=$2
         RETURNING *`,
        [id_mision, id_usuario]
      );
      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Misión no asignada a este usuario", 404);
      }

      await client.query(
        `INSERT INTO validacionmision (id_mision, id_usuario, id_validador, resultado, fecha_validacion)
         VALUES ($1,$2,$3,'aprobada',NOW())`,
        [id_mision, id_usuario, id_validador]
      );

      // Actualizar recompensas usuario
      let nuevoXP = usuario.xp + xp;
      let nuevoNivel = usuario.nivel;
      while (nuevoXP >= 1000) { nuevoXP -= 1000; nuevoNivel += 1; }
      const nuevoMonedas = usuario.monedas + monedas;
      const nuevoGemas = usuario.gemas + gemas;

      await client.query(
        `UPDATE usuario
         SET xp=$1, nivel=$2, monedas=$3, gemas=$4
         WHERE id_usuario=$5`,
        [nuevoXP, nuevoNivel, nuevoMonedas, nuevoGemas, id_usuario]
      );

      // Ranking individual
      const rankingUsuario = await client.query(
        `SELECT id_usuario FROM ranking WHERE id_usuario=$1 FOR UPDATE`,
        [id_usuario]
      );
      if (rankingUsuario.rows.length) {
        await client.query(
          `UPDATE ranking SET puntos = puntos + 1, nivel=$2 WHERE id_usuario=$1`,
          [id_usuario, nuevoNivel]
        );
      } else {
        await client.query(
          `INSERT INTO ranking (id_usuario, puntos, nivel) VALUES ($1,1,$2)`,
          [id_usuario, nuevoNivel]
        );
      }

    } else {
      // ------------------ MISIÓN DE UNIDAD ------------------
      const { id_unidad, id_directiva } = misionUnidadQuery.rows[0];

      if (id_usuario !== id_directiva) {
        await client.query("ROLLBACK");
        return errorResponse(res, "Solo el líder de la unidad puede validar esta misión", 403);
      }

      // Obtener todos los miembros de la unidad
      const miembros = await client.query(
        `SELECT u.id_usuario, u.xp, u.nivel, u.monedas, u.gemas
         FROM unidadusuario uu
         JOIN usuario u ON uu.id_usuario = u.id_usuario
         WHERE uu.id_unidad=$1 FOR UPDATE`,
        [id_unidad]
      );

      // Actualizar recompensas y misionusuario de todos los miembros
      for (const miembro of miembros.rows) {
        let xpFinal = miembro.xp + xp;
        let nivelFinal = miembro.nivel;
        while (xpFinal >= 1000) { xpFinal -= 1000; nivelFinal += 1; }
        const monedasFinal = miembro.monedas + monedas;
        const gemasFinal = miembro.gemas + gemas;

        await client.query(
          `UPDATE usuario SET xp=$1, nivel=$2, monedas=$3, gemas=$4 WHERE id_usuario=$5`,
          [xpFinal, nivelFinal, monedasFinal, gemasFinal, miembro.id_usuario]
        );

        // Actualizar o insertar misionusuario
        await client.query(
          `INSERT INTO misionusuario (id_mision, id_usuario, estado, intentos, fecha_completada)
           VALUES ($1,$2,'completada',1,NOW())
           ON CONFLICT (id_mision, id_usuario) DO UPDATE
           SET estado='completada', intentos = misionusuario.intentos + 1, fecha_completada=NOW()`,
          [id_mision, miembro.id_usuario]
        );
      }

      // Insertar validación solo con el líder
      await client.query(
        `INSERT INTO validacionmision (id_mision, id_usuario, id_validador, resultado, fecha_validacion)
         VALUES ($1,$2,$3,'aprobada',NOW())`,
        [id_mision, id_usuario, id_validador]
      );

      // Ranking de unidad: solo 1 punto
      const rankingUnidad = await client.query(
        "SELECT id_unidad FROM ranking WHERE id_unidad=$1 FOR UPDATE",
        [id_unidad]
      );
      if (rankingUnidad.rows.length) {
        await client.query("UPDATE ranking SET puntos=puntos+1 WHERE id_unidad=$1", [id_unidad]);
      } else {
        await client.query("INSERT INTO ranking (id_unidad, puntos, nivel) VALUES ($1,1,1)", [id_unidad]);
      }
    }

    await client.query("COMMIT");

    // ------------------ RESPUESTA ------------------
    const misionActualizada = await client.query(
      `SELECT mu.id_mision, mu.id_usuario, mu.estado,
              u.xp, u.monedas, u.gemas, u.nivel
       FROM misionusuario mu
       JOIN usuario u ON mu.id_usuario = u.id_usuario
       WHERE mu.id_mision=$1 AND mu.id_usuario=$2`,
      [id_mision, id_usuario]
    );

    const rangos = [
      "Novato","Recluta","Soldado","Guerrero","Veterano",
      "Héroe","Campeón","Maestro","Élite","Leyenda"
    ];

    const usuarioConRango = {
      ...misionActualizada.rows[0],
      rango: rangos[misionActualizada.rows[0].nivel - 1] || "Leyenda"
    };

    return successResponse(res, usuarioConRango, "Misión completada y recompensas otorgadas");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en validarMision:", err);
    return errorResponse(res, "Error interno del servidor: " + err.message, 500);
  } finally {
    client.release();
  }
};


// ---------------------- ELIMINAR MISIÓN ----------------------
export const eliminarMision = async (req, res) => {
  try {
    const { id_mision } = req.params;

    await pool.query("DELETE FROM MisionUsuario WHERE id_mision=$1", [id_mision]);
    await pool.query("DELETE FROM ValidacionMision WHERE id_mision=$1", [id_mision]);
    await pool.query("DELETE FROM MisionUnidad WHERE id_mision=$1", [id_mision]);
    await pool.query("DELETE FROM Mision WHERE id_mision=$1", [id_mision]);

    await registrarAuditoria(
      req.user?.id || null,
      `Eliminó misión ${id_mision}`,
      "DELETE",
      "Mision",
      id_mision,
      null,
      req.ip,
      req.headers["user-agent"]
    );

    return successResponse(res, null, "Misión eliminada correctamente");
  } catch (err) {
    console.error("Error en eliminarMision:", err);
    return errorResponse(res, err.message, 500);
  }
};


// ---------------------- LISTAR TODAS LAS MISIONES (ADMIN) ----------------------
export const listarMisiones = async (req, res) => {
  try {
    const { tipo, semana, temporada } = req.query;
    const params = [];

    let query = `
      SELECT 
        m.id_mision,
        m.nombre,
        m.tipo,
        m.dificultad,
        m.xp,
        m.monedas,
        m.gemas,
        m.fecha_inicio,
        m.fecha_fin,
        CASE 
          WHEN mu2.id_unidad IS NOT NULL THEN 'unidad'
          ELSE 'individual'
        END AS mision_asignacion,
        CASE
          WHEN mu2.id_unidad IS NOT NULL THEN un.id_directiva
          ELSE u.id_usuario
        END AS id_usuario,
        CASE
          WHEN mu2.id_unidad IS NOT NULL THEN (SELECT nombre FROM usuario WHERE id_usuario = un.id_directiva)
          ELSE u.nombre
        END AS usuario_nombre,
        mu.estado,
        mu.fecha_completada,
        mu.intentos
      FROM mision m
      LEFT JOIN misionunidad mu2 ON m.id_mision = mu2.id_mision
      LEFT JOIN unidad un ON mu2.id_unidad = un.id_unidad
      LEFT JOIN misionusuario mu ON m.id_mision = mu.id_mision AND (mu2.id_unidad IS NULL OR mu.id_usuario = un.id_directiva)
      LEFT JOIN usuario u ON mu.id_usuario = u.id_usuario
      WHERE 
        (u.rol IS NULL OR u.rol <> 'administrador')
    `;

    if (tipo) { 
      params.push(tipo); 
      query += ` AND m.tipo=$${params.length}`; 
    }
    if (semana) { 
      params.push(semana); 
      query += ` AND EXTRACT(WEEK FROM m.fecha_inicio)=$${params.length}`; 
    }
    if (temporada) { 
      params.push(temporada); 
      query += ` AND m.id_temporada=$${params.length}`; 
    }

    query += ` ORDER BY m.fecha_inicio DESC`;

    const result = await pool.query(query, params);
    return successResponse(res, result.rows);

  } catch (err) {
    console.error("Error en listarMisiones:", err);
    return errorResponse(res, err.message, 500);
  }
};
