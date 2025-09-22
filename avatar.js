// backend/routes/avatar.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Crear carpeta uploads/avatars si no existe
const uploadDir = "uploads/avatars";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configuración de multer para avatars
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id_usuario}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// POST /api/usuarios/avatar
router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No se subió archivo" });

    // URL completa para el frontend
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

    await pool.query(
      "UPDATE Usuario SET avatar = $1 WHERE id_usuario = $2",
      [avatarUrl, req.user.id_usuario]
    );

    res.json({ data: { avatar: avatarUrl }, message: "Avatar actualizado correctamente" });
  } catch (err) {
    console.error("Error al subir avatar:", err);
    res.status(500).json({ message: "Error al subir avatar" });
  }
});

export default router;
