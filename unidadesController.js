import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// -------------------- Crear unidad --------------------
export const crearUnidad = async (req, res) => {
  try {
    const { nombre, limite, requisitos, miembros, id_directiva } = req.body;
    if (!nombre || !limite)
      return errorResponse(res, "Nombre y límite son obligatorios", 400);

    const existe = await pool.query("SELECT * FROM Unidad WHERE nombre=$1", [nombre]);
    if (existe.rows.length > 0)
      return errorResponse(res, "Unidad ya existe", 400);

    const result = await pool.query(
      "INSERT INTO Unidad (nombre, limite, requisitos, id_directiva, activo) VALUES ($1,$2,$3,$4,true) RETURNING *",
      [nombre, limite, requisitos, id_directiva || null]
    );

    const id_unidad = result.rows[0].id_unidad;

    if (Array.isArray(miembros) && miembros.length > 0) {
      for (let idusuario of miembros) {
        await pool.query(
          "INSERT INTO UnidadUsuario (id_unidad, id_usuario) VALUES ($1,$2)",
          [id_unidad, idusuario]
        );
      }
    }

    await registrarAuditoria(
  req.user.id,                 // ID del usuario que ejecuta la acción
  `Creó unidad ${nombre}`,     // acción
  "CREATE",                    // acción_tipo
  "Unidad",                    // tabla afectada
  id_unidad,                   // registro_id
  { nombre, limite, requisitos, id_directiva, miembros }, // detalles
  req.ip,                      // IP del usuario
  req.headers["user-agent"]    // dispositivo
);

    return successResponse(res, result.rows[0], "Unidad creada");
  } catch (err) {
    console.error("Error en crearUnidad:", err);
    return errorResponse(res, "Error al crear unidad: " + err.message, 500);
  }
};

// -------------------- Editar unidad --------------------
export const editarUnidad = async (req, res) => {
  try {
    const { id_unidad } = req.params;
    const { nombre, limite, requisitos, miembros, id_directiva } = req.body;

    const result = await pool.query(
      "UPDATE Unidad SET nombre=$1, limite=$2, requisitos=$3, id_directiva=$4 WHERE id_unidad=$5 RETURNING *",
      [nombre, limite, requisitos, id_directiva || null, id_unidad]
    );

    if (result.rowCount === 0) {
      return errorResponse(res, `Unidad con id ${id_unidad} no encontrada`, 404);
    }

    if (Array.isArray(miembros)) {
      await pool.query("DELETE FROM UnidadUsuario WHERE id_unidad=$1", [id_unidad]);
      for (let idusuario of miembros) {
        await pool.query(
          "INSERT INTO UnidadUsuario (id_unidad, id_usuario) VALUES ($1,$2)",
          [id_unidad, idusuario]
        );
      }
    }

    await registrarAuditoria(
  req.user.id,
  `Editó unidad ${id_unidad}`,
  "UPDATE",
  "Unidad",
  id_unidad,
  { nombre, limite, requisitos, id_directiva, miembros },
  req.ip,
  req.headers["user-agent"]
);

    return successResponse(res, result.rows[0], "Unidad actualizada");
  } catch (err) {
    console.error("Error en editarUnidad:", err);
    return errorResponse(res, "Error al editar unidad: " + err.message, 500);
  }
};

// -------------------- Desactivar unidad --------------------
export const desactivarUnidad = async (req, res) => {
  try {
    const { id_unidad } = req.params;
    const result = await pool.query(
      "UPDATE Unidad SET activo=false WHERE id_unidad=$1 RETURNING *",
      [id_unidad]
    );
    if (result.rowCount === 0)
      return errorResponse(res, `Unidad con id ${id_unidad} no encontrada`, 404);

    await registrarAuditoria(
  req.user.id,
  `Desactivó unidad ${id_unidad}`,
  "UPDATE",
  "Unidad",
  id_unidad,
  null,
  req.ip,
  req.headers["user-agent"]
);

    return successResponse(res, null, "Unidad desactivada");
  } catch (err) {
    console.error("Error en desactivarUnidad:", err);
    return errorResponse(res, "Error al desactivar unidad: " + err.message, 500);
  }
};

// -------------------- Listar unidades con miembros --------------------
export const listarUnidades = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id_unidad, 
        u.nombre, 
        u.limite, 
        u.requisitos, 
        u.id_directiva,
        d.nombre AS directiva_nombre,
        COUNT(uu.id_usuario) AS miembros_count,
        json_agg(
          json_build_object(
            'id_usuario', us.id_usuario,
            'nombre', us.nombre,
            'email', us.email
          )
        ) FILTER (WHERE us.id_usuario IS NOT NULL) AS miembros
      FROM unidad u
      LEFT JOIN unidadusuario uu ON uu.id_unidad = u.id_unidad
      LEFT JOIN usuario us 
        ON us.id_usuario = uu.id_usuario 
        AND us.rol NOT IN ('admin','administrador')
      LEFT JOIN usuario d ON u.id_directiva = d.id_usuario
      WHERE u.activo = true
      GROUP BY u.id_unidad, d.nombre
      ORDER BY u.nombre
    `);

    return successResponse(res, result.rows);
  } catch (err) {
    console.error("Error en listarUnidades:", err);
    return errorResponse(res, "Error al listar unidades: " + err.message, 500);
  }
};

// -------------------- Asignar miembros a unidad --------------------
export const asignarMiembros = async (req, res) => {
  try {
    const { idunidad, miembros, id_directiva } = req.body;
    if (!idunidad || !Array.isArray(miembros))
      return errorResponse(res, "Se requiere id_unidad y array de miembros", 400);

    const usuariosValidos = await pool.query(
      `SELECT id_usuario FROM usuario 
       WHERE id_usuario = ANY($1) 
         AND rol NOT IN ('admin', 'administrador')`,
      [miembros]
    );
    const miembrosFiltrados = usuariosValidos.rows.map(u => u.id_usuario);

    if (miembrosFiltrados.length === 0)
      return errorResponse(res, "No se puede asignar usuarios con rol administrativo", 400);

    const existentes = await pool.query(
      "SELECT id_usuario FROM UnidadUsuario WHERE id_unidad=$1",
      [idunidad]
    );
    const existentesIds = existentes.rows.map(r => r.id_usuario);

    const nuevosMiembros = miembrosFiltrados.filter(id => !existentesIds.includes(id));

    const limiteUnidad = (await pool.query("SELECT limite FROM Unidad WHERE id_unidad=$1", [idunidad])).rows[0].limite;
    if (existentesIds.length + nuevosMiembros.length > limiteUnidad)
      return errorResponse(res, "Se excede el límite de miembros", 400);

    for (let idusuario of nuevosMiembros) {
      await pool.query("INSERT INTO UnidadUsuario (id_unidad, id_usuario) VALUES ($1,$2)", [idunidad, idusuario]);
    }

    if (id_directiva) {
      const esAdmin = await pool.query(
        `SELECT 1 FROM usuario WHERE id_usuario=$1 AND rol IN ('admin', 'administrador')`,
        [id_directiva]
      );
      if (esAdmin.rowCount > 0)
        return errorResponse(res, "No se puede asignar un líder con rol administrativo", 400);
      await pool.query("UPDATE Unidad SET id_directiva=$1 WHERE id_unidad=$2", [id_directiva, idunidad]);
    }

    await registrarAuditoria(
  req.user.id,
  `Asignó miembros y líder a unidad ${idunidad}`,
  "UPDATE",
  "UnidadUsuario",
  idunidad,
  { miembros_nuevos: nuevosMiembros, miembros_existentes: existentesIds, id_directiva },
  req.ip,
  req.headers["user-agent"]
);

    return successResponse(res, { idunidad, miembros: [...existentesIds, ...nuevosMiembros], id_directiva }, "Miembros y líder asignados");
  } catch (err) {
    console.error("Error en asignarMiembros:", err);
    return errorResponse(res, "Error al asignar miembros: " + err.message, 500);
  }
};

// -------------------- Ranking de unidades --------------------
export const rankingUnidades = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id_unidad,
        u.nombre AS unidad,
        COUNT(mu.id_mision) AS total_misiones_completadas
      FROM unidad u
      LEFT JOIN misionunidad muu ON muu.id_unidad = u.id_unidad
      LEFT JOIN misionusuario mu 
        ON mu.id_mision = muu.id_mision AND mu.fecha_completada IS NOT NULL
      WHERE u.activo = true
      GROUP BY u.id_unidad, u.nombre
      ORDER BY total_misiones_completadas DESC, u.nombre ASC
    `);

    const ranking = result.rows.map(row => ({
      id_unidad: row.id_unidad,
      unidad: row.unidad,
      total_misiones_completadas: parseInt(row.total_misiones_completadas, 10)
    }));

    return successResponse(res, ranking);
  } catch (err) {
    console.error("Error en rankingUnidades:", err);
    return errorResponse(res, "Error al obtener ranking de unidades: " + err.message, 500);
  }
};

// -------------------- Obtener usuarios ocupados --------------------
export const obtenerUsuariosOcupados = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT uu.id_usuario, u.nombre, u.email, uu.id_unidad
      FROM unidadusuario uu
      INNER JOIN usuario u ON uu.id_usuario = u.id_usuario
      WHERE u.rol NOT IN ('admin','administrador')
    `);
    return successResponse(res, result.rows);
  } catch (err) {
    console.error("Error en obtenerUsuariosOcupados:", err);
    return errorResponse(res, "Error al obtener usuarios ocupados: " + err.message, 500);
  }
};
