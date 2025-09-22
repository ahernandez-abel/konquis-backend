import pool from "../config/db.js";

/**
 * Registrar auditoría en la base de datos
 * 
 * @param {number} id_usuario - ID del usuario que realiza la acción
 * @param {string} accion - Descripción breve de la acción
 * @param {string} accion_tipo - Tipo de acción: CREATE, UPDATE, DELETE, LOGIN, etc.
 * @param {string} tabla_afectada - Tabla afectada (opcional)
 * @param {string|number} registro_id - ID del registro afectado (opcional)
 * @param {object} detalles - Detalles adicionales (opcional), se guarda como JSON
 * @param {string} ip - IP del usuario (opcional)
 * @param {string} dispositivo - Dispositivo o user-agent (opcional)
 */
export const registrarAuditoria = async (
  id_usuario,
  accion,
  accion_tipo = "GENERAL",
  tabla_afectada = null,
  registro_id = null,
  detalles = null,
  ip = null,
  dispositivo = null
) => {
  try {
    await pool.query(
      `INSERT INTO LogAuditoria 
        (id_usuario, accion_tipo, tabla_afectada, registro_id, accion, detalles, ip, dispositivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id_usuario || null,
        accion_tipo,
        tabla_afectada,
        registro_id ? registro_id.toString() : null,
        accion,
        detalles ? JSON.stringify(detalles) : null,
        ip || null,
        dispositivo || null
      ]
    );
  } catch (err) {
    console.error("[Auditoría ERROR]: No se pudo guardar:", err.message);
  }
};
