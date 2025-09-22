import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import { registrarTransaccion, listarTransaccionesUsuario } from "../controllers/transaccionesController.js";

const router = express.Router();

// ------------------- Registrar transacciones -------------------
router.post("/", authMiddleware, checkPermiso("admin_usuario"), registrarTransaccion);

// ------------------- Listar transacciones de un usuario -------------------
router.get("/usuario/:id_usuario", authMiddleware, checkPermiso("usuario"), listarTransaccionesUsuario);

export default router;
