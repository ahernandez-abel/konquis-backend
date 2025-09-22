// backend/controllers/tiendaController.js
import pool from "../config/db.js";
import { successResponse, errorResponse } from "../utils/responseHelper.js";
import { registrarAuditoria } from "../utils/auditoriaHelper.js";

// ------------------- Crear Artículo -------------------
export const crearArticulo = async (req, res) => {
  try {
    const { nombre, descripcion, costo_monedas, costo_gemas, stock } = req.body;
    const imagen = req.file ? `/uploads/articulos/${req.file.filename}` : null;

    if (!nombre) return errorResponse(res, "Nombre del artículo es obligatorio", 400);

    const result = await pool.query(
      `INSERT INTO Articulo (nombre, descripcion, costo_monedas, costo_gemas, stock, imagen)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre, descripcion || null, costo_monedas || 0, costo_gemas || 0, stock || 0, imagen]
    );

    await registrarAuditoria(
  req.user?.id_usuario || null,
  `Creó artículo ${nombre}`,
  "CREATE",          // acción_tipo
  "Articulo",        // tabla afectada
  result.rows[0].id_articulo, // registro_id
  { nombre, descripcion, costo_monedas, costo_gemas, stock, imagen }, // detalles
  req.ip,
  req.headers["user-agent"]
);


    return successResponse(res, result.rows[0], "Artículo creado");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Editar Artículo -------------------
export const editarArticulo = async (req, res) => {
  try {
    const { id_articulo } = req.params;
    const { nombre, descripcion, costo_monedas, costo_gemas, stock } = req.body;
    const imagen = req.file ? `/uploads/articulos/${req.file.filename}` : null;

    await pool.query(
      `UPDATE Articulo 
       SET nombre=$1, descripcion=$2, costo_monedas=$3, costo_gemas=$4, stock=$5, imagen=$6
       WHERE id_articulo=$7`,
      [nombre, descripcion || null, costo_monedas || 0, costo_gemas || 0, stock || 0, imagen, id_articulo]
    );

    await registrarAuditoria(
  req.user?.id_usuario || null,
  `Editó artículo ${id_articulo}`,
  "UPDATE",
  "Articulo",
  id_articulo,
  { nombre, descripcion, costo_monedas, costo_gemas, stock, imagen },
  req.ip,
  req.headers["user-agent"]
);
    return successResponse(res, null, "Artículo actualizado");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Listar Artículos -------------------
export const listarArticulos = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Articulo ORDER BY nombre ASC");
    return successResponse(res, result.rows, "Artículos obtenidos");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Eliminar Artículo -------------------
export const eliminarArticulo = async (req, res) => {
  try {
    const { id_articulo } = req.params;
    await pool.query("DELETE FROM Articulo WHERE id_articulo=$1", [id_articulo]);

    await registrarAuditoria(
  req.user?.id_usuario || null,
  `Eliminó artículo ${id_articulo}`,
  "DELETE",
  "Articulo",
  id_articulo,
  null,
  req.ip,
  req.headers["user-agent"]
);

    return successResponse(res, null, "Artículo eliminado");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Registrar Compra -------------------
export const registrarCompra = async (req, res) => {
  try {
    const { id_usuario, id_articulo, cantidad, usar_monedas = true, usar_gemas = true } = req.body;
    if (!id_usuario || !id_articulo || !cantidad) {
      return errorResponse(res, "Datos incompletos", 400);
    }

    // Usuario
    const userRes = await pool.query("SELECT monedas, gemas FROM Usuario WHERE id_usuario=$1", [id_usuario]);
    const usuario = userRes.rows[0];
    if (!usuario) return errorResponse(res, "Usuario no encontrado", 404);

    // Artículo
    const artRes = await pool.query(
      "SELECT stock, costo_monedas, costo_gemas FROM Articulo WHERE id_articulo=$1",
      [id_articulo]
    );
    const articulo = artRes.rows[0];
    if (!articulo) return errorResponse(res, "Artículo no encontrado", 404);
    if (articulo.stock < cantidad) return errorResponse(res, "Stock insuficiente", 400);

    // Costos totales
    let total_monedas = usar_monedas ? articulo.costo_monedas * cantidad : 0;
    let total_gemas = usar_gemas ? articulo.costo_gemas * cantidad : 0;

    // Verificar saldo
    if (usuario.monedas < total_monedas || usuario.gemas < total_gemas) {
      return errorResponse(res, "Saldo insuficiente para completar la compra", 400);
    }

    // Actualizar usuario
    await pool.query(
      "UPDATE Usuario SET monedas = monedas - $1, gemas = gemas - $2 WHERE id_usuario = $3",
      [total_monedas, total_gemas, id_usuario]
    );

    // Reducir stock
    await pool.query("UPDATE Articulo SET stock = stock - $1 WHERE id_articulo = $2", [cantidad, id_articulo]);

    // Insertar compra
    const result = await pool.query(
      `INSERT INTO Compra (id_usuario, id_articulo, cantidad, total_monedas, total_gemas)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id_usuario, id_articulo, cantidad, total_monedas, total_gemas]
    );

    await registrarAuditoria(
  req.user?.id_usuario || null,
  `Usuario ${id_usuario} compró ${cantidad} de artículo ${id_articulo}`,
  "CREATE",
  "Compra",
  result.rows[0].id_compra,
  { total_monedas, total_gemas, usar_monedas, usar_gemas, articulo: { id_articulo, nombre: articulo.nombre } },
  req.ip,
  req.headers["user-agent"]
);


    return successResponse(res, result.rows[0], "Compra registrada correctamente");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Historial de Compras -------------------
export const historialCompras = async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const result = await pool.query(
      `SELECT c.*, a.nombre AS articulo_nombre, a.descripcion, a.imagen 
       FROM Compra c 
       JOIN Articulo a ON c.id_articulo = a.id_articulo
       WHERE c.id_usuario=$1
       ORDER BY c.fecha DESC`,
      [id_usuario]
    );
    return successResponse(res, result.rows, "Historial de compras cargado");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

// ------------------- Listar Artículos Disponibles -------------------
export const listarArticulosUsuario = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_articulo, nombre, descripcion, costo_monedas, costo_gemas, stock, imagen
       FROM Articulo
       WHERE stock > 0
       ORDER BY nombre ASC`
    );

    return successResponse(res, result.rows, "Artículos cargados correctamente");
  } catch (err) {
    return errorResponse(res, err.message);
  }
};
