import pool from "../config/db.js";
import { successResponse, errorResponse, registrarAuditoria } from "../utils/responseHelper.js";

// ----------------- LISTAR LOGS DE AUDITORÍA -----------------
export const listarLogs = async (req, res) => {
  try {
    const { id_usuario } = req.query; // opcional: filtrar por usuario
    let query = `
      SELECT la.*, u.nombre AS nombre_usuario
      FROM LogAuditoria la
      LEFT JOIN Usuario u ON u.id_usuario = la.id_usuario
    `;
    let params = [];

    if (id_usuario) {
      query += " WHERE la.id_usuario=$1";
      params.push(id_usuario);
    }

    query += " ORDER BY la.fecha DESC";

    const result = await pool.query(query, params);
    return successResponse(res, result.rows);
  } catch (err) {
    console.error("Error en listarLogs:", err);
    return errorResponse(res, "Error al listar logs: " + err.message, 500);
  }
};

// ----------------- REGISTRAR BACKUP -----------------
export const registrarBackup = async (req, res) => {
  try {
    const { descripcion, ruta_archivo } = req.body;
    if (!descripcion || !ruta_archivo) {
      return errorResponse(res, "Datos incompletos", 400);
    }

    const result = await pool.query(
      `INSERT INTO BackupHistorial (descripcion, ruta_archivo) 
       VALUES ($1, $2) RETURNING *`,
      [descripcion, ruta_archivo]
    );

    // Registrar auditoría
    await registrarAuditoria(
      req.user?.id,                         // id_usuario
      `Se registró backup: ${descripcion}`, // acción
      "CREATE",                              // acción_tipo
      "BackupHistorial",                     // tabla afectada
      result.rows[0].id_backup,             // registro_id
      { ruta_archivo }                       // detalles
    );

    return successResponse(res, result.rows[0], "Backup registrado");
  } catch (err) {
    console.error("Error en registrarBackup:", err);
    return errorResponse(res, "Error al registrar backup: " + err.message, 500);
  }
};

// ----------------- LISTAR BACKUPS -----------------
export const listarBackups = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM BackupHistorial ORDER BY fecha DESC"
    );
    return successResponse(res, result.rows);
  } catch (err) {
    console.error("Error en listarBackups:", err);
    return errorResponse(res, "Error al listar backups: " + err.message, 500);
  }
};
