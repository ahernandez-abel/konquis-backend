import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ----------------- CREAR USUARIO -----------------
export const crearUsuario = async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
      return errorResponse(res, "Todos los campos son obligatorios", 400);
    }

    await client.query("BEGIN");

    const existe = await client.query("SELECT * FROM Usuario WHERE email=$1", [email]);
    if (existe.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, "El email ya está registrado", 400);
    }

    const result = await client.query(
      `INSERT INTO Usuario (nombre, email, password, rol, activo, fecha_creacion) 
       VALUES ($1, $2, $3, $4, true, NOW()) 
       RETURNING id_usuario, nombre, email, rol, activo`,
      [nombre, email, password, rol]
    );

    // Registrar auditoría
    try {
     await registrarAuditoria(
  req.user?.id_usuario || null,   // quien ejecuta
  `Usuario creado: ${email}`,     // descripción de la acción
  "CREATE",                       // tipo de acción
  "Usuario",                      // tabla afectada
  result.rows[0].id_usuario,      // ID del registro afectado
  { nombre, rol },                // detalles adicionales
  req.ip,                          // IP
  req.headers["user-agent"]       // dispositivo
);
    } catch (errAud) {
      console.error("Error en auditoría:", errAud);
      // No hacemos rollback por auditoría, usuario ya se creó
    }

    await client.query("COMMIT");

    return successResponse(res, result.rows[0], "Usuario creado con éxito");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en crearUsuario:", error);
    return errorResponse(res, "Error al crear usuario: " + error.message, 500);
  } finally {
    client.release();
  }
};



// ----------------- LOGIN USUARIO -----------------
export const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM Usuario WHERE LOWER(email)=$1",
      [email.toLowerCase()]
    );

    if (user.rows.length === 0) {
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    const dbUser = user.rows[0];

    if (!dbUser.activo) {
      return errorResponse(res, "Usuario desactivado. Contacta al administrador.", 403);
    }

    if ((password || "").trim() !== (dbUser.password || "").trim()) {
      return errorResponse(res, "Credenciales incorrectas", 401);
    }

    const token = jwt.sign(
      {
        id_usuario: dbUser.id_usuario,
        email: dbUser.email,
        rol: dbUser.rol,
        nombre: dbUser.nombre
      },
      process.env.JWT_SECRET || "secreto_jwt",
      { expiresIn: "3h" }
    );

    await registrarAuditoria(
      dbUser.id_usuario,
      "Login Usuario",
      `Usuario inició sesión: ${email}`
    );

    return successResponse(res, {
      token,
      rol: dbUser.rol,
      nombre: dbUser.nombre,
      email: dbUser.email
    }, "Login exitoso");

  } catch (error) {
    console.error("Error en loginUsuario:", error);
    return errorResponse(res, "Error al iniciar sesión: " + error.message, 500);
  }
};

// ----------------- EDITAR USUARIO -----------------
export const editarUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { nombre, email, password, rol, activo } = req.body;

    await pool.query(
      "UPDATE Usuario SET nombre=$1, email=$2, password=$3, rol=$4, activo=$5 WHERE id_usuario=$6",
      [nombre, email, password, rol, activo, id_usuario]
    );

    await registrarAuditoria(
  req.user.id_usuario,
  `Usuario editado: ${email}`,
  "UPDATE",
  "Usuario",
  id_usuario,
  { nombre, rol, activo },
  req.ip,
  req.headers["user-agent"]
);
    return successResponse(res, null, "Usuario actualizado");
  } catch (error) {
    console.error("Error en editarUsuario:", error);
    return errorResponse(res, "Error al editar usuario: " + error.message, 500);
  }
};

// ----------------- CAMBIAR ESTADO USUARIO -----------------
export const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { activo } = req.body;

    await pool.query("UPDATE Usuario SET activo=$1 WHERE id_usuario=$2", [activo, id_usuario]);

    await registrarAuditoria(
  req.user.id_usuario,                    // id_usuario que realiza la acción
  `${activo ? "Activó" : "Desactivó"} usuario ${id_usuario}`, // acción
  "UPDATE",                               // acción_tipo
  "Usuario",                              // tabla afectada
  id_usuario,                              // registro_id
  { activo },                              // detalles adicionales
  req.ip,                                  // IP del usuario
  req.headers["user-agent"]               // dispositivo
);

    return successResponse(res, null, `Usuario ${activo ? "activado" : "desactivado"}`);
  } catch (error) {
    console.error("Error en cambiarEstadoUsuario:", error);
    return errorResponse(res, "Error al cambiar estado del usuario: " + error.message, 500);
  }
};

// ----------------- LISTAR USUARIOS -----------------
export const listarUsuarios = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id_usuario, nombre, email, rol, activo FROM Usuario WHERE activo=true ORDER BY nombre ASC"
    );
    return successResponse(res, result.rows);
  } catch (error) {
    console.error("Error en listarUsuarios:", error);
    return errorResponse(res, "Error al listar usuarios: " + error.message, 500);
  }
};

// ----------------- INFO USUARIO LOGUEADO -----------------
export const infoUsuario = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario, nombre, email, rol, avatar 
       FROM Usuario 
       WHERE id_usuario = $1`,
      [req.user.id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error("Error obteniendo info usuario:", err);
    res.status(500).json({ message: "Error al obtener información del usuario" });
  }
};