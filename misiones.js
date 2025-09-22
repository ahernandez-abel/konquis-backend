import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import {
  crearMision,
  editarMision,
  listarMisiones,
  asignarMision,
  validarMision,
  eliminarMision
} from "../controllers/misionesController.js";

const router = express.Router();

// ---------------- CRUD de misiones (solo admin) ----------------
router.post("/", authMiddleware, checkPermiso("admin_usuario"), crearMision);
router.put("/:id_mision", authMiddleware, checkPermiso("admin_usuario"), editarMision);
router.get("/", authMiddleware, checkPermiso("admin_usuario"), listarMisiones);
router.delete("/:id_mision", authMiddleware, checkPermiso("admin_usuario"), eliminarMision);

// ---------------- Asignar misión a usuario o unidad ----------------
router.post("/asignar", authMiddleware, checkPermiso("admin_usuario"), asignarMision);

// ---------------- Validar misión completada por usuario ----------------
router.post("/validar", authMiddleware, checkPermiso("admin_usuario"), validarMision);


export default router;
