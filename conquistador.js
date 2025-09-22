// backend/routes/conquistadorRoutes.js
import express from "express";
import { 
  listarMisionesUsuario,
  listarMisionesUnidadUsuario,
  subirEvidencia,
  listarInsignias,
  rankingIndividual,
  rankingUnidad,
  infoUnidad,
  listarNotificaciones,
  resumenTemporada,
  progresoNivel
} from "../controllers/conquistadorController.js";

import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../utils/multer.js"; // <-- Importamos Multer

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ----------------- RUTAS -----------------
router.get("/misiones", listarMisionesUsuario);              
router.get("/misiones/unidad", listarMisionesUnidadUsuario); 

// Ahora la ruta de subir evidencia acepta un archivo opcional con Multer
router.post(
  "/misiones/evidencia",
  upload.single("archivo"), // <-- "archivo" es el name del input en React
  subirEvidencia
);

router.get("/insignias", listarInsignias);                  
router.get("/ranking/individual", rankingIndividual);       
router.get("/ranking/unidad", rankingUnidad);               
router.get("/unidad", infoUnidad);                          
router.get("/notificaciones", listarNotificaciones);        
router.get("/temporada", resumenTemporada);                 
router.get("/progreso", progresoNivel);                     

export default router;
