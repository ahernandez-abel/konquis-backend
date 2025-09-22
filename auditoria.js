import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import { listarLogs, registrarBackup, listarBackups } from "../controllers/auditoriaController.js";

const router = express.Router();


// Logs de auditoría
router.get("/logs", authMiddleware, checkPermiso("admin_usuario"), listarLogs);

// Registrar backup
router.post("/backups", authMiddleware, checkPermiso("admin_usuario"), registrarBackup);

// Listar backups
router.get("/backups", authMiddleware, checkPermiso("admin_usuario"), listarBackups);



export default router;
