// backend/controllers/configuracionController.js
import pool from "../config/db.js";  
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ------------------- Obtener configuración del sistema -------------------
export const obtenerConfiguracion = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ConfiguracionSistema LIMIT 1");

    // Auditoría
    await registrarAuditoria(
      req.user?.id_usuario || null,
      "Consultó configuración del sistema",
      "READ",
      "ConfiguracionSistema",
      result.rows[0]?.id_configuracion || null,
      null
    );

    return successResponse(res, result.rows[0], "Configuración obtenida");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Actualizar configuración del sistema -------------------
export const actualizarConfiguracion = async (req, res) => {
  try {
    const { logo, color_tema, notificaciones } = req.body;

    const result = await pool.query(
      `UPDATE ConfiguracionSistema 
       SET logo=$1, color_tema=$2, notificaciones=$3
       RETURNING *`,
      [logo, color_tema, notificaciones]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      "Actualizó configuración del sistema",
      "UPDATE",
      "ConfiguracionSistema",
      result.rows[0]?.id_configuracion || null,
      { logo, color_tema, notificaciones }
    );

    return successResponse(res, result.rows[0], "Configuración actualizada");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Crear notificación -------------------
export const crearNotificacion = async (req, res) => {
  try {
    const { id_usuario, mensaje } = req.body;
    if (!id_usuario || !mensaje) return errorResponse(res, "Datos incompletos", 400);

    const result = await pool.query(
      `INSERT INTO Notificacion (id_usuario, mensaje) VALUES ($1,$2) RETURNING *`,
      [id_usuario, mensaje]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      "Creó notificación",
      "CREATE",
      "Notificacion",
      result.rows[0].id_notificacion,
      { id_usuario, mensaje }
    );

    return successResponse(res, result.rows[0], "Notificación creada");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Listar notificaciones de un usuario -------------------
export const listarNotificaciones = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const result = await pool.query(
      `SELECT * FROM Notificacion WHERE id_usuario=$1 ORDER BY fecha DESC`,
      [id_usuario]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Consultó notificaciones del usuario ${id_usuario}`,
      "READ",
      "Notificacion",
      null,
      null
    );

    return successResponse(res, result.rows, "Notificaciones obtenidas");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Marcar notificación como leída -------------------
export const marcarLeida = async (req, res) => {
  try {
    const { id_notificacion } = req.params;
    await pool.query(
      "UPDATE Notificacion SET leida=TRUE WHERE id_notificacion=$1",
      [id_notificacion]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Marcó notificación ${id_notificacion} como leída`,
      "UPDATE",
      "Notificacion",
      id_notificacion,
      null
    );

    return successResponse(res, null, "Notificación marcada como leída");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
