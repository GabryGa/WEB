const mongoose = require('mongoose'); // Importa Mongoose per interfacciarsi con MongoDB

// Definisce lo schema dell'utente
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true }, // Campo email, unico e obbligatorio
  password: { type: String, required: true } // Campo password, obbligatorio
});

module.exports = mongoose.model('User', userSchema); // Esporta il modello User basato sullo schema definito
