const express = require('express'); // Importa il framework Express per creare un server web
const bcrypt = require('bcrypt'); // Importa bcrypt per hashing delle password
const mongoose = require('mongoose'); // Importa Mongoose per interfacciarsi con MongoDB
const User = require('./User'); // Importa il modello User
const Sensor = require('./Sensor'); // Importa il modello Sensor
const http = require('http'); // Importa il modulo HTTP di Node.js
const path = require('path'); // Importa il modulo Path di Node.js

const app = express(); // Crea un'applicazione Express
app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve file statici dalla directory 'public'
app.use(express.json()); // Middleware per parsare richieste JSON

// Connessione a MongoDB
mongoose.connect('mongodb://localhost:27017/nomeDatabase').then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore di connessione a MongoDB', err));

// Route per la registrazione di un nuovo utente
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body; // Estrae email e password dal body della richiesta
    const existingUser = await User.findOne({ email }); // Controlla se esiste già un utente con quella email
    if (existingUser) {
      return res.status(400).send('Email già utilizzata.');
    }
    const hashedPassword = await bcrypt.hash(password, 10); // Hascia la password con bcrypt
    const user = new User({ email, password: hashedPassword }); // Crea un nuovo utente con la password hashata
    await user.save(); // Salva il nuovo utente nel database
    res.status(201).send('Registrazione completata.');
  } catch (error) {
    res.status(500).send('Errore server.');
  }
});

// Route per il login di un utente
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // Estrae email e password dal body della richiesta
    const user = await User.findOne({ email }); // Cerca l'utente per email
    if (user && await bcrypt.compare(password, user.password)) { // Confronta la password hashata con quella salvata
      res.status(200).send({ message: 'Login riuscito', user: user._id });
    } else {
      res.status(401).send({ message: 'Login fallito' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Errore server' });
  }
});

// Route per aggiungere un nuovo sensore
app.post('/sensors', async (req, res) => {
  const { user, name, type, updateInterval } = req.body; // Estrae i dettagli del sensore dal body della richiesta
  const sensor = new Sensor({
    user: new mongoose.Types.ObjectId(user), // Converte l'ID utente in ObjectId
    name,
    type,
    updateInterval
  });
  try {
    await sensor.save(); // Salva il sensore nel database
    res.send({ message: 'Sensore aggiunto' });
  } catch (error) {
    res.status(400).send('Errore nell\'aggiunta del sensore');
  }
});

// Route per ottenere tutti i sensori di un utente
app.get('/sensors', async (req, res) => {
  const { user } = req.query; // Estrae l'ID utente dai query parameters
  const sensors = await Sensor.find({ user: new mongoose.Types.ObjectId(user) }); // Trova tutti i sensori per quell'utente
  res.json(sensors);
});

// Route per aggiornare un sensore
app.patch('/sensors/:id', async (req, res) => {
  try {
    const updates = req.body; // Estrae i dati aggiornati dal body della richiesta
    const sensor = await Sensor.findByIdAndUpdate(req.params.id, updates, { new: true }); // Trova e aggiorna il sensore
    if (!sensor) {
      return res.status(404).send({ message: 'Sensore non trovato' });
    }
    res.send(sensor);
  } catch (error) {
    res.status(400).send({ message: 'Errore durante la modifica del sensore' });
  }
});

// Route per eliminare un sensore
app.delete('/sensors/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findByIdAndDelete(req.params.id); // Trova e elimina il sensore
    if (!sensor) {
      return res.status(404).send({ message: 'Sensore non trovato' });
    }
    res.send({ message: 'Sensore eliminato' });
  } catch (error) {
    res.status(500).send({ message: 'Errore durante l\'eliminazione del sensore' });
  }
});

// Route per servire la pagina della dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Crea e avvia il server
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
  