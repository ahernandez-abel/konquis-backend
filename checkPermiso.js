import pool from "../config/db.js";

export const checkPermiso = (permiso) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }

      const { id_usuario } = req.user;

      const result = await pool.query(
        "SELECT rol FROM Usuario WHERE id_usuario=$1",
        [id_usuario]
      );

      const rol = result.rows[0]?.rol;

      if (rol !== "administrador") {
        return res.status(403).json({ message: "No tienes permiso para acceder a este módulo" });
      }

      next(); // Usuario admin → permite acceso
    } catch (err) {
      console.error("Error en checkPermiso:", err);
      return res.status(500).json({ message: "Error al verificar permisos" });
    }
  };
};
