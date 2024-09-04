const express = require('express'); // Importa il framework Express per creare applicazioni web e API
const bcrypt = require('bcrypt'); // Importa il modulo bcrypt per la crittografia delle password
const mongoose = require('mongoose'); // Importa Mongoose, un ODM (Object Data Modeling) per MongoDB
const User = require('./User'); // Importa il modello User dal file './User'
const Sensor = require('./Sensor'); // Importa il modello Sensor dal file './Sensor'
const http = require('http'); // Importa il modulo http nativo di Node.js per creare il server
const path = require('path'); // Importa il modulo path nativo di Node.js per lavorare con i percorsi dei file
const app = express(); // Crea un'applicazione Express
const server = http.createServer(app); // Crea un server HTTP utilizzando l'applicazione Express
const io = require('socket.io')(server); // Inizializza socket.io e lo collega al server HTTP
const sensorIntervals = {}; // Mappa per tracciare gli intervalli dei sensori

app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve file statici dalla directory 'public'
app.use(express.json()); // Middleware per parsare richieste JSON

mongoose.connect('mongodb://localhost:27017/nomeDatabase') // Connessione a MongoDB
  .then(() => console.log('Connesso a MongoDB')) // Log di conferma connessione a MongoDB
  .catch(err => console.error('Errore di connessione a MongoDB', err)); // Log di errore in caso di fallimento connessione a MongoDB

  // API route per la registrazione
  app.post('/api/register', async (req, res) => {
      const { email, password } = req.body;
      try {
          const existingUser = await User.findOne({ email });
          if (existingUser) {
              return res.status(409).send({ message: 'Email già utilizzata.' });
          }
          const hashedPassword = await bcrypt.hash(password, 10);
          const user = new User({ email, password: hashedPassword });
          await user.save();
          res.send({ message: 'Registrazione completata.' });
      } catch (error) {
          res.status(500).send({ message: 'Errore server durante la registrazione.' });
      }
  });
  
  // API route per l'accesso
  app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;
      try {
          const user = await User.findOne({ email });
          if (user && await bcrypt.compare(password, user.password)) {
              res.send({ message: 'Login riuscito', user: user._id });
          } else {
              res.status(401).send({ message: 'Login fallito' });
          }
      } catch (error) {
          res.status(500).send({ message: 'Errore server durante il login' });
      }
  });  

io.on('connection', socket => { // Gestisce l'evento di connessione di un nuovo client  

    socket.on('fetch-sensors', async (userId) => { // Gestisce la richiesta di recupero dei sensori di un utente
        try {
            const sensors = await Sensor.find({ user: userId }); // Trova tutti i sensori per l'utente specificato
            socket.emit('sensors-list', sensors); // Invia la lista dei sensori al client richiedente
        } catch (error) {
            socket.emit('error', 'Errore nel recupero dei sensori'); // Notifica un errore durante il recupero dei sensori
        }
    });

    socket.on('delete-sensor', async (id) => { // Gestisce l'eliminazione di un sensore
        try {
            const sensor = await Sensor.findByIdAndDelete(id); // Trova e elimina il sensore per ID
            if (!sensor) { // Se il sensore non è trovato
                socket.emit('sensor-delete-failed', 'Sensore non trovato'); // Notifica il fallimento dell'eliminazione
                return; // Termina l'esecuzione
            }
            clearInterval(sensorIntervals[id]); // Cancella l'intervallo
            delete sensorIntervals[id]; // Rimuovi la chiave dall'oggetto
            io.emit('sensor-deleted', { message: 'Sensore eliminato', id: id }); // Notifica a tutti i client connessi l'eliminazione del sensore
        } catch (error) {
            socket.emit('error', 'Errore durante l\'eliminazione del sensore'); // Notifica un errore durante l'eliminazione del sensore
        }
    });

    socket.on('add-sensor', async (data) => { // Gestisce l'aggiunta di un nuovo sensore
        const { user, name, type, updateInterval } = data; // Estrae i dati del sensore dai dati ricevuti
        const sensor = new Sensor({ user, name, type, updateInterval }); // Crea un nuovo sensore
        try {
            await sensor.save(); // Salva il sensore nel database
            setOrUpdateInterval(sensor); // Aggiorna l'intervallo esistente o ne crea uno nuovo
            io.emit('sensor-added', sensor); // Notifica a tutti i client connessi l'aggiunta di un nuovo sensore
        } catch (error) {
            socket.emit('error', 'Errore nell\'aggiunta del sensore'); // Notifica un errore durante l'aggiunta del sensore
        }
    });

    socket.on('update-sensor', async (data) => { // Gestisce l'aggiornamento di un sensore
        const { id, name, type, updateInterval } = data; // Estrae i dati aggiornati del sensore
        try {
            const sensor = await Sensor.findByIdAndUpdate(id, { name, type, updateInterval }, { new: true }); // Trova e aggiorna il sensore per ID
            if (!sensor) { // Se il sensore non è trovato
                socket.emit('update-failed', 'Sensore non trovato'); // Notifica il fallimento dell'aggiornamento
                return; // Termina l'esecuzione
            }
            setOrUpdateInterval(sensor); // Aggiorna l'intervallo esistente o ne crea uno nuovo
            io.emit('sensor-updated', sensor); // Notifica a tutti i client connessi l'aggiornamento del sensore
        } catch (error) {
            socket.emit('error', "Errore durante l'aggiornamento del sensore"); // Notifica un errore durante l'aggiornamento del sensore
        }
    });
});

// Funzione per simulare i dati di un singolo sensore
function simulateSensorData(sensor) {
    const simulatedValue = Math.random() * 100;
    sensor.currentValue = simulatedValue;
    sensor.save().catch(err => console.error('Errore nel salvare il sensore:', err));
    io.emit('sensor-added', {
        sensorId: sensor._id.toString(),
        name: sensor.name,
        type: sensor.type,
        newValue: simulatedValue
    });
}

// Funzione per avviare la simulazione per tutti i sensori
function startSensorSimulation() {
    Sensor.find({}).then(sensors => {
        sensors.forEach(sensor => {
            setOrUpdateInterval(sensor); // Imposta gli intervalli per ciascun sensore
        });
    }).catch(err => {
        console.error('Errore durante il recupero dei sensori:', err);
    });
}

// Avvia la simulazione all'avvio del server
startSensorSimulation();

// Funzione per cancellare e riavviare l'intervallo di un sensore
function setOrUpdateInterval(sensor) {
    // Cancella l'intervallo esistente se presente
    if (sensorIntervals[sensor._id]) {
        clearInterval(sensorIntervals[sensor._id]);
    }
    // Imposta un nuovo intervallo
    sensorIntervals[sensor._id] = setInterval(() => simulateSensorData(sensor), sensor.updateInterval * 1000);
}

app.get('/dashboard', (req, res) => { // Route per servire la pagina della dashboard
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')); // Invia il file 'dashboard.html' al client
});

const PORT = process.env.PORT || 3000; // Imposta la porta su cui il server ascolterà (di default 3000)
server.listen(PORT, () => { // Avvia il server HTTP sulla porta specificata
    console.log(`Server in ascolto sulla porta ${PORT}`); // Log di conferma dell'avvio del server
});
