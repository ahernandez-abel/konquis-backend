import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import { crearUnidad, editarUnidad, desactivarUnidad, listarUnidades, asignarMiembros, rankingUnidades, 
    obtenerUsuariosOcupados  } from "../controllers/unidadesController.js";

const router = express.Router();

// ------------------- CRUD Unidades -------------------
router.post("/", authMiddleware, checkPermiso("admin_usuario"), crearUnidad);
router.put("/:id_unidad", authMiddleware, checkPermiso("admin_usuario"), editarUnidad);
router.delete("/:id_unidad", authMiddleware, checkPermiso("admin_usuario"), desactivarUnidad);
router.get("/", authMiddleware, checkPermiso("admin_usuario"), listarUnidades);
router.get("/ranking", authMiddleware, checkPermiso("admin_usuario"), rankingUnidades);

// ------------------- Asignar miembros -------------------
router.post("/miembros", authMiddleware, checkPermiso("admin_usuario"), asignarMiembros);


// Obtener miembros actuales de una unidad

router.get("/usuarios/ocupados", authMiddleware, checkPermiso("admin_usuario"), obtenerUsuariosOcupados);

export default router;
