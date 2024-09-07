// db.js
const mysql = require('mysql2/promise'); // Importa il modulo mysql2 con promesse

const pool = mysql.createPool({
  host: 'localhost', // Host del database
  user: 'root', // Utente del database
  password: 'root', // Password del database
  database: 'sensori_db', // Nome del database
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;