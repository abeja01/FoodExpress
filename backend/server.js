
const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

function verificarToken(req, res, next) {
  const autorizacion = req.headers.authorization;

  if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
    return res.status(401).json({
      mensaje: 'Debes iniciar sesión para consultar tus pedidos.'
    });
  }

  const token = autorizacion.slice(7);

  try {
    req.cliente = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: 'Tu sesión ha vencido o el token no es válido.'
    });
  }
}


// Página principal
app.get('/', (req, res) => {
  res.send('¡Bienvenido a FoodExpress!');
});


 // HU-01: Registrar cliente
app.post('/api/clientes/registro', async (req, res) => {
  const { nombre, correo, password } = req.body || {};

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    nombre.trim().length > 100 ||
    typeof correo !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
    correo.trim().length > 150 ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      mensaje: 'Ingresa un nombre, correo válido y una contraseña de 8 a 72 caracteres.'
    });
  }

  try {
    const nombreLimpio = nombre.trim();
    const correoLimpio = correo.trim().toLowerCase();
    const contraseñaHash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `INSERT INTO clientes (nombre, correo, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, correo, fecha_registro`,
      [nombreLimpio, correoLimpio, contraseñaHash]
    );

    return res.status(201).json({
      mensaje: 'Cuenta creada correctamente.',
      cliente: resultado.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'Ya existe una cuenta con ese correo.'
      });
    }

    console.error('Error al registrar cliente:', error);

    return res.status(500).json({
      mensaje: 'No se pudo registrar la cuenta.'
    });
  }
});


// HU-02: Inicio de sesión
app.post('/api/clientes/login', async (req, res) => {
  try {
    const { correo, password } = req.body || {};

    if (
      typeof correo !== 'string' ||
      !correo.trim() ||
      correo.trim().length > 150 ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 72
    ) {
      return res.status(400).json({
        mensaje: 'Ingresa un correo válido y una contraseña.'
      });
    }

    const resultado = await pool.query(
      `SELECT id, nombre, correo, password_hash
       FROM clientes
       WHERE correo = $1`,
      [correo.trim().toLowerCase()]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });
    }

    const cliente = resultado.rows[0];

    const passwordCorrecta = await bcrypt.compare(
      password,
      cliente.password_hash
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('Falta configurar JWT_SECRET en el archivo .env');
    }

    const token = jwt.sign(
      {
        id: cliente.id,
        nombre: cliente.nombre
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      mensaje: 'Inicio de sesión correcto.',
      token,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        correo: cliente.correo
      }
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);

    return res.status(500).json({
      mensaje: 'Error interno al iniciar sesión.'
    });
  }
});


// GET: Listar productos
app.get('/api/productos', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM productos ORDER BY id'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar productos:', error.message);
    res.status(500).json({
      mensaje: 'Error al obtener productos'
    });
  }
});

// GET: Buscar producto por ID
app.get('/api/productos/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      mensaje: 'ID inválido'
    });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM productos WHERE id = $1',
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Producto no encontrado'
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al buscar producto:', error.message);
    res.status(500).json({
      mensaje: 'Error al buscar producto'
    });
  }
});

// POST: Registrar producto
app.post('/api/productos', async (req, res) => {
  const { nombre, precio } = req.body || {};

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    nombre.trim().length > 100 ||
    typeof precio !== 'number' ||
    !Number.isFinite(precio) ||
    precio <= 0 ||
    precio > 99999999.99
  ) {
    return res.status(400).json({
      mensaje: 'Nombre y precio válido son obligatorios'
    });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO productos (nombre, precio)
       VALUES ($1, $2)
       RETURNING *`,
      [nombre.trim(), precio]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al registrar producto:', error.message);
    res.status(500).json({
      mensaje: 'Error al registrar producto'
    });
  }
});

// PUT: Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, precio } = req.body || {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      mensaje: 'ID inválido'
    });
  }

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    nombre.trim().length > 100 ||
    typeof precio !== 'number' ||
    !Number.isFinite(precio) ||
    precio <= 0 ||
    precio > 99999999.99
  ) {
    return res.status(400).json({
      mensaje: 'Nombre y precio válido son obligatorios'
    });
  }

  try {
    const resultado = await pool.query(
      `UPDATE productos
       SET nombre = $1, precio = $2
       WHERE id = $3
       RETURNING *`,
      [nombre.trim(), precio, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Producto no encontrado'
      });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar producto:', error.message);
    res.status(500).json({
      mensaje: 'Error al actualizar producto'
    });
  }
});

// DELETE: Eliminar producto

app.delete('/api/productos/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      mensaje: 'ID inválido'
    });
  }

  try {
    // Comprobar si el producto está asociado a pedidos
    const detalle = await pool.query(
      `SELECT 1
       FROM detalle_pedidos
       WHERE producto_id = $1
       LIMIT 1`,
      [id]
    );

    if (detalle.rows.length > 0) {
      // Si tiene pedidos, conservarlo y desactivarlo
      const resultado = await pool.query(
        `UPDATE productos
         SET disponible = FALSE
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({
          mensaje: 'Producto no encontrado'
        });
      }

      return res.json({
        mensaje: 'Producto desactivado porque está asociado a pedidos anteriores.'
      });
    }

    // Si nunca se ha pedido, se puede eliminar
    const resultado = await pool.query(
      `DELETE FROM productos
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Producto no encontrado'
      });
    }

    return res.json({
      mensaje: 'Producto eliminado correctamente.'
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudo eliminar el producto.'
    });
  }
});


 // HU-07: Consultar mis pedidos
app.get('/api/clientes/mis-pedidos', verificarToken, async (req, res) => {
  try {
    const clienteId = req.cliente.id;

    const resultado = await pool.query(
      `SELECT id, total, estado, fecha
       FROM pedidos
       WHERE cliente_id = $1
       ORDER BY fecha DESC`,
      [clienteId]
    );

    return res.status(200).json({
      mensaje: 'Pedidos consultados correctamente.',
      pedidos: resultado.rows
    });
  } catch (error) {
    console.error('Error al consultar mis pedidos:', error);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar tus pedidos.'
    });
  }
});



 // GET: Listar pedidos para administración e historial
app.get('/api/pedidos', async (req, res) => {
  try {
    const { fecha } = req.query;

    let consulta = `
      SELECT
        id,
        cliente_nombre,
        cliente_telefono,
        cliente_direccion,
        total,
        estado,
        fecha
      FROM pedidos
    `;

    const valores = [];

    if (fecha) {
      consulta += ` WHERE fecha >= $1::date
                    AND fecha < ($1::date + INTERVAL '1 day')`;
      valores.push(fecha);
    }

    consulta += ' ORDER BY fecha DESC';

    const resultado = await pool.query(consulta, valores);

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar pedidos:', error);
    res.status(500).json({
      mensaje: 'Error al consultar los pedidos'
    });
  }
});


// POST: Registrar pedido
app.post('/api/pedidos', verificarToken, async (req, res) => {
  console.log('Datos recibidos para el pedido:', req.body);
  const {
    nombre,
    telefono,
    direccion,
    productos
  } = req.body || {};

  if (
    typeof nombre !== 'string' ||
    !nombre.trim() ||
    nombre.trim().length > 100 ||
    typeof telefono !== 'string' ||
    !telefono.trim() ||
    telefono.trim().length > 20 ||
    typeof direccion !== 'string' ||
    !direccion.trim() ||
    !Array.isArray(productos) ||
    productos.length === 0 ||
    productos.some(p =>
      !p ||
      !Number.isSafeInteger(p.id) ||
      p.id <= 0 ||
      !Number.isSafeInteger(p.cantidad) ||
      p.cantidad <= 0
    ) 
    
  ){
    return res.status(400).json({
      mensaje: 'Datos del pedido inválidos'
    });
  }
  
  const clienteId = req.cliente.id;

console.log('Cliente autenticado al registrar pedido:', req.cliente);
console.log('ID del cliente:', clienteId);

  const conexion = await pool.connect();

  try {
    await conexion.query('BEGIN');

    let totalCentimos = 0;
    const detalles = [];

    for (const item of productos) {
      const resultado = await conexion.query(
        `SELECT id, nombre, precio
         FROM productos
         WHERE id = $1 AND disponible = TRUE`,
        [item.id]
      );

      if (resultado.rows.length === 0) {
        const error = new Error(
          `Producto ${item.id} no encontrado o no disponible`
        );
        error.status = 400;
        throw error;
      }

      const producto = resultado.rows[0];
      const precioCentimos = Math.round(
        Number(producto.precio) * 100
      );
      const subtotalCentimos = precioCentimos * item.cantidad;

      if (
        !Number.isSafeInteger(subtotalCentimos) ||
        !Number.isSafeInteger(totalCentimos + subtotalCentimos)
      ) {
        const error = new Error(
          'Importe del pedido demasiado grande'
        );
        error.status = 400;
        throw error;
      }

      totalCentimos += subtotalCentimos;

      detalles.push({
        id: producto.id,
        cantidad: item.cantidad,
        precio: (precioCentimos / 100).toFixed(2),
        subtotal: (subtotalCentimos / 100).toFixed(2)
      });
    }

    if (totalCentimos > 9999999999) {
      const error = new Error(
        'El total supera el máximo permitido'
      );
      error.status = 400;
      throw error;
    }

    const pedidoResultado = await conexion.query(
      `INSERT INTO pedidos
       (
         cliente_id,
         cliente_nombre,
         cliente_telefono,
         cliente_direccion,
         total
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, cliente_id, total, estado, fecha`,
      [
        clienteId,
        nombre.trim(),
        telefono.trim(),
        direccion.trim(),
        (totalCentimos / 100).toFixed(2)
      ]
    );

    const pedido = pedidoResultado.rows[0];

    for (const detalle of detalles) {
      await conexion.query(
        `INSERT INTO detalle_pedidos
         (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          pedido.id,
          detalle.id,
          detalle.cantidad,
          detalle.precio,
          detalle.subtotal
        ]
      );
    }

    await conexion.query('COMMIT');

    res.status(201).json({
      mensaje: 'Pedido registrado correctamente',
      pedido
    });
  } catch (error) {
    await conexion.query('ROLLBACK');

    console.error(
      'Error al registrar pedido:',
      error.message
    );

    res.status(error.status || 500).json({
      mensaje: error.status
        ? error.message
        : 'Error al registrar pedido'
    });
  } finally {
    conexion.release();
  }
});

// GET: Consultar detalle de un pedido
app.get('/api/pedidos/:id/detalle', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'El número de pedido no es válido.'
      });
    }

    const resultado = await pool.query(
      `SELECT
         dp.pedido_id,
         dp.producto_id,
         p.nombre AS producto,
         dp.cantidad,
         dp.precio_unitario,
         dp.subtotal
       FROM detalle_pedidos dp
       INNER JOIN productos p
         ON p.id = dp.producto_id
       WHERE dp.pedido_id = $1
       ORDER BY dp.id`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'El pedido no tiene productos registrados.'
      });
    }

    res.json(resultado.rows);
  } catch (error) {
    console.error(
      'Error al consultar detalle del pedido:',
      error
    );

    res.status(500).json({
      mensaje: 'No se pudo consultar el detalle del pedido.'
    });
  }
});

// PUT: Actualizar estado de un pedido
app.put('/api/pedidos/:id/estado', async (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body || {};

  const estadosPermitidos = [
    'pendiente',
    'en preparación',
    'entregado'
  ];

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      mensaje: 'El número de pedido no es válido.'
    });
  }

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      mensaje: 'El estado indicado no es válido.'
    });
  }

  try {
    const resultado = await pool.query(
      `UPDATE pedidos
       SET estado = $1
       WHERE id = $2
       RETURNING id, estado`,
      [estado, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Pedido no encontrado.'
      });
    }

    res.json({
      mensaje: 'Estado del pedido actualizado correctamente.',
      pedido: resultado.rows[0]
    });
  } catch (error) {
    console.error(
      'Error al actualizar el estado:',
      error
    );

    res.status(500).json({
      mensaje: 'No se pudo actualizar el estado del pedido.'
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(
    `FoodExpress funcionando en http://localhost:${PORT}`
  );
});
