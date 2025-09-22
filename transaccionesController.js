// backend/controllers/transaccionController.js
import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ------------------- Registrar transacción (XP, monedas, gemas) -------------------
export const registrarTransaccion = async (req, res) => {
  try {
    const { id_usuario, tipo, cantidad, motivo, id_responsable } = req.body;

    if (!id_usuario || !tipo || cantidad === undefined)
      return errorResponse(res, "Datos incompletos", 400);
    if (!['xp','monedas','gemas'].includes(tipo))
      return errorResponse(res, "Tipo inválido", 400);

    const result = await pool.query(
      `INSERT INTO Transaccion (id_usuario, tipo, cantidad, motivo, id_responsable)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id_usuario, tipo, cantidad, motivo || '', id_responsable || null]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Registró transacción: ${tipo} ${cantidad} a usuario ${id_usuario}`,
      req.ip,
      req.headers["user-agent"]
    );

    return successResponse(res, result.rows[0], "Transacción registrada");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Listar transacciones de un usuario -------------------
export const listarTransaccionesUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const result = await pool.query(
      `SELECT t.*, u.nombre AS responsable_nombre
       FROM Transaccion t
       LEFT JOIN Usuario u ON t.id_responsable = u.id_usuario
       WHERE t.id_usuario=$1
       ORDER BY t.fecha DESC`,
      [id_usuario]
    );

    return successResponse(res, result.rows, "Transacciones obtenidas");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
