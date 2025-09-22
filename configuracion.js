import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  crearNotificacion,
  listarNotificaciones,
  marcarLeida
} from "../controllers/configuracionController.js";

const router = express.Router();

// Configuración del sistema
router.get("/", authMiddleware, checkPermiso("admin_usuario"), obtenerConfiguracion);
router.put("/", authMiddleware, checkPermiso("admin_usuario"), actualizarConfiguracion);

// Notificaciones
router.post("/notificaciones", authMiddleware, checkPermiso("admin_usuario"), crearNotificacion);
router.get("/notificaciones/:id_usuario", authMiddleware, checkPermiso("usuario"), listarNotificaciones);
router.put("/notificaciones/:id_notificacion/leida", authMiddleware, checkPermiso("usuario"), marcarLeida);

export default router;
