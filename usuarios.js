import express from "express";
import { body } from "express-validator";
import { 
  crearUsuario, 
  loginUsuario, 
  editarUsuario, 
  cambiarEstadoUsuario, 
  listarUsuarios,
  infoUsuario
 
} from "../controllers/usuariosController.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import { checkPermiso } from "../middleware/checkPermiso.js";

const router = express.Router();

// ------------------ Rutas públicas ------------------
router.post(
  "/register",
  [
    body("nombre").notEmpty().withMessage("El nombre es requerido"),
    body("email").isEmail().withMessage("Correo inválido"),
    body("password").isLength({ min: 6 }).withMessage("Contraseña mínimo 6 caracteres"),
    body("rol").notEmpty().withMessage("El rol es requerido")
  ],
  validate,
  crearUsuario
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Correo inválido"),
    body("password").notEmpty().withMessage("Contraseña requerida")
  ],
  validate,
  loginUsuario
);

// ------------------ Rutas protegidas ------------------
router.put("/:id_usuario", authMiddleware, checkPermiso("admin_usuario"), editarUsuario);

router.patch("/:id_usuario/estado", authMiddleware, checkPermiso("admin_usuario"), cambiarEstadoUsuario);

router.get("/", authMiddleware, checkPermiso("admin_usuario"), listarUsuarios);

router.get("/info", authMiddleware, infoUsuario);

export default router;
