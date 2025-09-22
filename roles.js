import express from "express";
import { crearRol, asignarPermisos } from "../controllers/rolesController.js";
import { authMiddleware } from "../middleware/auth.js";

import { checkPermiso } from "../middleware/checkPermiso.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", authMiddleware, checkPermiso("admin_usuario"), crearRol);
router.post("/permisos", authMiddleware, checkPermiso("admin_usuario"), asignarPermisos);

export default router;
