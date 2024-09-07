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

app.use(express.static(path.join(__dirname, '..', 'public'))); // Serve file statici dalla directory 'public'
app.use(express.json()); // Middleware per parsare richieste JSON

mongoose.connect('mongodb://localhost:27017/nomeDatabase') // Connessione a MongoDB
  .then(() => console.log('Connesso a MongoDB')) // Log di conferma connessione a MongoDB
  .catch(err => console.error('Errore di connessione a MongoDB', err)); // Log di errore in caso di fallimento connessione a MongoDB

io.on('connection', socket => { // Gestisce l'evento di connessione di un nuovo client
    socket.on('register', async (data) => { // Gestisce la registrazione di un nuovo utente
        const { email, password } = data; // Estrae email e password dai dati ricevuti
        try {
            const existingUser = await User.findOne({ email }); // Controlla se esiste già un utente con questa email
            if (existingUser) { // Se l'utente esiste già
                socket.emit('registration-failed', 'Email già utilizzata.'); // Notifica il fallimento della registrazione
                return; // Termina l'esecuzione
            }
            const hashedPassword = await bcrypt.hash(password, 10); // Hascia la password con bcrypt
            const user = new User({ email, password: hashedPassword }); // Crea un nuovo utente con la password hashata
            await user.save(); // Salva il nuovo utente nel database
            socket.emit('registration-success', 'Registrazione completata.'); // Notifica il successo della registrazione
        } catch (error) {
            socket.emit('error', 'Errore server durante la registrazione.'); // Notifica un errore durante la registrazione
        }
    });

    socket.on('login', async (data) => { // Gestisce il login di un utente
        const { email, password } = data; // Estrae email e password dai dati ricevuti
        try {
            const user = await User.findOne({ email }); // Cerca l'utente per email nel database
            if (user && await bcrypt.compare(password, user.password)) { // Se l'utente esiste e la password corrisponde
                socket.emit('login-success', { message: 'Login riuscito', user: user._id }); // Notifica il successo del login
            } else {
                socket.emit('login-failed', { message: 'Login fallito' }); // Notifica il fallimento del login
            }
        } catch (error) {
            socket.emit('error', { message: 'Errore server durante il login' }); // Notifica un errore durante il login
        }
    });

    socket.on('add-sensor', async (data) => { // Gestisce l'aggiunta di un nuovo sensore
        const { user, name, type, updateInterval } = data; // Estrae i dati del sensore dai dati ricevuti
        const sensor = new Sensor({ user, name, type, updateInterval }); // Crea un nuovo sensore
        try {
            await sensor.save(); // Salva il sensore nel database
            io.emit('sensor-added', sensor); // Notifica a tutti i client connessi l'aggiunta di un nuovo sensore
        } catch (error) {
            socket.emit('error', 'Errore nell\'aggiunta del sensore'); // Notifica un errore durante l'aggiunta del sensore
        }
    });

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
            io.emit('sensor-deleted', { message: 'Sensore eliminato', id: id }); // Notifica a tutti i client connessi l'eliminazione del sensore
        } catch (error) {
            socket.emit('error', 'Errore durante l\'eliminazione del sensore'); // Notifica un errore durante l'eliminazione del sensore
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
            io.emit('sensor-updated', sensor); // Notifica a tutti i client connessi l'aggiornamento del sensore
        } catch (error) {
            socket.emit('error', "Errore durante l'aggiornamento del sensore"); // Notifica un errore durante l'aggiornamento del sensore
        }
    });
});

app.get('/dashboard', (req, res) => { // Route per servire la pagina della dashboard
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')); // Invia il file 'dashboard.html' al client
});

const PORT = process.env.PORT || 3000; // Imposta la porta su cui il server ascolterà (di default 3000)
server.listen(PORT, () => { // Avvia il server HTTP sulla porta specificata
    console.log(`Server in ascolto sulla porta ${PORT}`); // Log di conferma dell'avvio del server
});
