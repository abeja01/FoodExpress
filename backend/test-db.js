
const pool = require('./db');

async function probarConexion() {
  try {
    const resultado = await pool.query(
      'SELECT NOW() AS fecha_servidor'
    );

    console.log('Conexión exitosa con PostgreSQL');
    console.log('Fecha del servidor:', resultado.rows[0].fecha_servidor);

  } catch (error) {
    console.error('Error de conexión:', error.message);

  } finally {
    await pool.end();
  }
}

probarConexion();
