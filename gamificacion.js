import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import {
  asignarLogro,
  crearRango,
  crearTemporada,
  asignarPuntosTemporada,
  crearRecompensaTemporada,
  listarLogrosUsuario,
  asignarRecursos,
  listarUsuariosConquistadores,
  listarUnidadesConquistadores,
  rankingGeneral,
  rankingPorUnidad,
  cerrarTemporada,
  listarTemporadas
} from "../controllers/gamificacionController.js";

const router = express.Router();

// Logros
router.post("/logros", authMiddleware, checkPermiso("admin_usuario"), asignarLogro);
router.get("/logros/:id_usuario", authMiddleware, checkPermiso("admin_usuario"), listarLogrosUsuario);

// Rangos
router.post("/rangos", authMiddleware, checkPermiso("admin_usuario"), crearRango);

// Temporadas y recompensas
router.post("/temporadas", authMiddleware, checkPermiso("admin_usuario"), crearTemporada);
router.post("/temporadas/puntos", authMiddleware, checkPermiso("admin_usuario"), asignarPuntosTemporada);
router.post("/temporadas/recompensas", authMiddleware, checkPermiso("admin_usuario"), crearRecompensaTemporada);

// Recursos y validación de logros
router.post("/usuarios/recursos", authMiddleware, checkPermiso("admin_usuario"), asignarRecursos);


// Usuarios Conquistadores
router.get("/usuarios/conquistadores", authMiddleware, checkPermiso("admin_usuario"), listarUsuariosConquistadores);
router.get("/unidades/conquistadores", authMiddleware, checkPermiso("admin_usuario"), listarUnidadesConquistadores);

router.get("/ranking", authMiddleware, checkPermiso("admin_usuario"), rankingGeneral);
router.get("/ranking/unidades", authMiddleware, checkPermiso("admin_usuario"), rankingPorUnidad);

router.post("/temporadas/cerrar", authMiddleware, checkPermiso("admin_usuario"), cerrarTemporada);
router.get("/temporadas", authMiddleware, checkPermiso("admin_usuario"), listarTemporadas);
export default router;
