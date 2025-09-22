// backend/controllers/rolController.js
import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ------------------- Crear rol -------------------
export const crearRol = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return errorResponse(res, "Nombre de rol requerido", 400);

    const existe = await pool.query("SELECT * FROM Rol WHERE nombre=$1", [nombre]);
    if (existe.rows.length > 0) return errorResponse(res, "Rol ya existe", 400);

    const result = await pool.query(
      "INSERT INTO Rol (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Creó rol: ${nombre}`,
      req.ip,
      req.headers["user-agent"]
    );

    return successResponse(res, result.rows[0], "Rol creado");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Asignar permisos a rol -------------------
export const asignarPermisos = async (req, res) => {
  try {
    const { id_rol, permisos } = req.body; // array de id_permiso
    if (!id_rol || !Array.isArray(permisos)) return errorResponse(res, "Datos inválidos", 400);

    // Limpiar permisos actuales
    await pool.query("DELETE FROM RolPermiso WHERE idrol=$1", [id_rol]);

    // Insertar nuevos permisos
    await Promise.all(
      permisos.map(id_permiso =>
        pool.query("INSERT INTO RolPermiso (id_rol, id_permiso) VALUES ($1,$2)", [id_rol, id_permiso])
      )
    );

    await registrarAuditoria(
      req.user?.id_usuario || null,
      `Asignó permisos al rol ${id_rol}: [${permisos.join(", ")}]`,
      req.ip,
      req.headers["user-agent"]
    );

    return successResponse(res, { id_rol, permisos }, "Permisos asignados");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
