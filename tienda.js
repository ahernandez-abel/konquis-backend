import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { upload } from "../utils/multer.js";
import { checkPermiso } from "../middleware/checkPermiso.js";
import {
  crearArticulo,
  editarArticulo,
  listarArticulos,
  eliminarArticulo,
  registrarCompra,
  historialCompras,
  listarArticulosUsuario
} from "../controllers/tiendaController.js";

const router = express.Router();

// ------------------- CRUD Artículos -------------------
router.post("/", authMiddleware, checkPermiso("admin_usuario"), upload.single("imagen"), crearArticulo);

router.put("/:id_articulo", authMiddleware, checkPermiso("admin_usuario"), upload.single("imagen"), editarArticulo);
router.get("/", authMiddleware, checkPermiso("admin_usuario"), listarArticulos);
router.delete("/:id_articulo", authMiddleware, checkPermiso("admin_usuario"), eliminarArticulo);

// ------------------- Compras de usuarios -------------------
router.post("/comprar", authMiddleware, checkPermiso("usuario"), registrarCompra);
router.get("/historial/:id_usuario", authMiddleware, checkPermiso("usuario"), historialCompras);

router.get("/usuario", authMiddleware, listarArticulosUsuario);


export default router;
