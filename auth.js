// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    console.log("❌ No se recibió Authorization header");
    return res.status(401).json({ message: "Token requerido" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  if (!token) {
    console.log("❌ No se pudo extraer el token del header");
    return res.status(401).json({ message: "Token inválido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_jwt");

    // Verificar si el usuario sigue activo en la base de datos
    const result = await pool.query(
      "SELECT activo FROM Usuario WHERE id_usuario=$1",
      [decoded.id_usuario]
    );

    if (result.rows.length === 0 || !result.rows[0].activo) {
      console.log("❌ Usuario desactivado");
      return res.status(403).json({ message: "Usuario desactivado" });
    }

    req.user = decoded; // { id_usuario, email, rol }
    console.log("✅ Token válido y usuario activo:", decoded);
    next();
  } catch (err) {
    console.error("❌ Token inválido o expirado:", err.message);
    return res.status(403).json({ message: "Token inválido o expirado" });
  }
};
