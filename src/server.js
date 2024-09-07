const express = require('express'); // Importa il framework Express per creare applicazioni web e API
const bcrypt = require('bcrypt'); // Importa il modulo bcrypt per la crittografia delle password
const pool = require('./db'); // Importa la connessione MySQL
const http = require('http'); // Importa il modulo http nativo di Node.js per creare il server
const path = require('path'); // Importa il modulo path nativo di Node.js per lavorare con i percorsi dei file
const app = express(); // Crea un'applicazione Express
const server = http.createServer(app); // Crea un server HTTP utilizzando l'applicazione Express
const io = require('socket.io')(server); // Inizializza socket.io e lo collega al server HTTP
const sensorIntervals = {}; // Mappa per tracciare gli intervalli dei sensori

app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve file statici dalla directory 'public'
app.use(express.json()); // Middleware per parsare richieste JSON

// API per la registrazione
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (rows.length > 0) {
        return res.status(409).send({ message: 'Email già utilizzata.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
      res.send({ message: 'Registrazione completata.' });
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      res.status(500).send({ message: 'Errore server durante la registrazione.' });
    }
  });
  
// API per il login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = rows[0];
      if (user && await bcrypt.compare(password, user.password)) {
        res.send({ message: 'Login riuscito', user: user.id });
      } else {
        res.status(401).send({ message: 'Login fallito' });
      }
    } catch (error) {
      console.error('Errore durante il login:', error);
      res.status(500).send({ message: 'Errore server durante il login' });
    }
  });

io.on('connection', socket => { // Gestisce l'evento di connessione di un nuovo client  

    socket.on('fetch-sensors', async (userId) => {
        try {
          const [sensors] = await pool.query('SELECT * FROM sensors WHERE user_id = ?', [userId]);
          socket.emit('sensors-list', sensors); // Send the list of sensors to the client
        } catch (error) {
          console.error('Errore nel recupero dei sensori:', error);
          socket.emit('error', 'Errore nel recupero dei sensori'); // Notify an error while retrieving sensors
        }
      });
    
      // Handle sensor deletion
      socket.on('delete-sensor', async (id) => {
        try {
          const [result] = await pool.query('DELETE FROM sensors WHERE id = ?', [id]);
          if (result.affectedRows === 0) {
            socket.emit('sensor-delete-failed', 'Sensore non trovato');
            return;
          }
          clearInterval(sensorIntervals[id]); // Cancel the interval
          delete sensorIntervals[id]; // Remove the key from the object
          io.emit('sensor-added');
        } catch (error) {
          console.error('Errore durante l\'eliminazione del sensore:', error);
          socket.emit('error', 'Errore durante l\'eliminazione del sensore');
        }
      });
    
      // Handle sensor updates
      socket.on('update-sensor', async (data) => {
        const { id, name, type, update_interval } = data; // Extract updated sensor data
        try {
          const [result] = await pool.query(
            'UPDATE sensors SET name = ?, type = ?, update_interval = ? WHERE id = ?',
            [name, type, update_interval, id]
          );
    
          if (result.affectedRows === 0) {
            socket.emit('update-failed', 'Sensore non trovato');
            return;
          }
    
          const [updatedSensor] = await pool.query('SELECT * FROM sensors WHERE id = ?', [id]);
          setOrUpdateInterval(updatedSensor[0]); // Update or create a new interval
          io.emit('sensor-added');
        } catch (error) {
          console.error("Errore durante l'aggiornamento del sensore:", error);
          socket.emit('error', "Errore durante l'aggiornamento del sensore");
        }
      });
    
        // Aggiungi un nuovo sensore
        socket.on('add-sensor', async (data) => {
            const { user, name, type, update_interval } = data;
            try {
                // Insert the new sensor into the database
                const [result] = await pool.query(
                    'INSERT INTO sensors (user_id, name, type, update_interval) VALUES (?, ?, ?, ?)',
                    [user, name, type, update_interval]
                );

                // Retrieve the newly inserted sensor using the insertId
                const [newSensor] = await pool.query('SELECT * FROM sensors WHERE id = ?', [result.insertId]);

                // Ensure the sensor was inserted, and set the interval for it
                if (newSensor.length > 0) {
                    setOrUpdateInterval(newSensor[0]); // Update or create a new interval
                    io.emit('sensor-added', newSensor[0]); // Emit the newly added sensor to the clients
                } else {
                    throw new Error('Sensore appena inserito non trovato.');
                }
            } catch (error) {
                console.error('Errore nell\'aggiunta del sensore:', error);
                socket.emit('error', 'Errore nell\'aggiunta del sensore');
            }
        });
});

// Function to simulate data for a single sensor
function simulateSensorData(sensor) {
    const simulatedValue = Math.random() * 100;
  
    // Update the sensor value in the database
    pool.query('UPDATE sensors SET current_value = ? WHERE id = ?', [simulatedValue, sensor.id])
      .then(() => {
        io.emit('sensor-added');
      })
      .catch(err => console.error('Errore nel salvare il sensore:', err));
  }
  

// Function to start simulation for all sensors
function startSensorSimulation() {
    pool.query('SELECT * FROM sensors')
      .then(([sensors]) => {
        sensors.forEach(sensor => {
          setOrUpdateInterval(sensor); // Set the intervals for each sensor
        });
      })
      .catch(err => console.error('Errore durante il recupero dei sensori:', err));
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
    sensorIntervals[sensor._id] = setInterval(() => simulateSensorData(sensor), sensor.update_interval * 1000);
}

app.get('/dashboard', (req, res) => { // Route per servire la pagina della dashboard
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')); // Invia il file 'dashboard.html' al client
});

const PORT = process.env.PORT || 3000; // Imposta la porta su cui il server ascolterà (di default 3000)
server.listen(PORT, () => { // Avvia il server HTTP sulla porta specificata
    console.log(`Server in ascolto sulla porta ${PORT}`); // Log di conferma dell'avvio del server
});
