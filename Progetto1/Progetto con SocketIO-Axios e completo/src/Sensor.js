const mongoose = require('mongoose'); // Importa Mongoose per interfacciarsi con MongoDB

// Definisce lo schema del sensore
const sensorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Riferimento all'ID dell'utente, obbligatorio
  name: { type: String, required: true }, // Campo nome, obbligatorio
  type: { type: String, required: true }, // Campo tipo, obbligatorio
  updateInterval: { type: Number, required: true }, // Campo intervallo di aggiornamento, obbligatorio
  currentValue: { type: Number, default: 0 } 
});

module.exports = mongoose.model('Sensor', sensorSchema); // Esporta il modello Sensor basato sullo schema definito
