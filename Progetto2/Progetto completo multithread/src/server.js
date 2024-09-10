const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('./User');
const Sensor = require('./Sensor');
const http = require('http');
const path = require('path');
const { Worker, isMainThread } = require('worker_threads'); // Import worker_threads module
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);
const sensorIntervals = {}; // Keep track of active sensor intervals
const workerPool = []; // Pool of worker threads
const MAX_WORKERS = 4; // Maximum number of worker threads

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/nomeDatabase')
  .then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore di connessione a MongoDB', err));

// Function to simulate sensor data using worker threads
function simulateSensorWithWorker(sensor) {
    return new Promise((resolve, reject) => {
        let worker = getAvailableWorker(); // Get an available worker

        if (!worker) {
            return reject(new Error('No available worker threads'));
        }

        // Log the worker assignment
        console.log(`Assigning Worker ${worker.threadId} to sensor ${sensor._id}`);

        // Send the sensor data to the worker for processing
        const sensorData = {
            _id: sensor._id.toString(), // Convert the ObjectId to a string for safety
            name: sensor.name,
            type: sensor.type,
            updateInterval: sensor.updateInterval
        };

        worker.postMessage(sensorData);

        const handleMessage = (result) => {
            console.log(`Sensor ${result.sensorId} was processed by Worker ${result.workerId} with new value: ${result.newValue}`);
            cleanup();
            resolve(result);
        };

        const handleError = (error) => {
            console.error(`Error in Worker ${worker.threadId}:`, error);
            cleanup();
            reject(error);
        };

        const handleExit = (code) => {
            if (code !== 0) {
                console.error(`Worker ${worker.threadId} stopped with exit code ${code}`);
                cleanup();
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        };

        const cleanup = () => {
            worker.off('message', handleMessage);
            worker.off('error', handleError);
            worker.off('exit', handleExit);
        };

        worker.once('message', handleMessage);
        worker.once('error', handleError);
        worker.once('exit', handleExit);
    });
}

// Function to initialize the worker pool
function initializeWorkerPool() {
    for (let i = 0; i < MAX_WORKERS; i++) {
        const worker = new Worker(path.join(__dirname, 'sensorWorker.js'));
        console.log(`Worker ${worker.threadId} created.`);
        workerPool.push(worker);
    }
}


let currentWorkerIndex = 0; // Keep track of the current worker index

// Function to get an available worker from the pool using round-robin
function getAvailableWorker() {
    const worker = workerPool[currentWorkerIndex];
    
    // Move to the next worker for the next assignment
    currentWorkerIndex = (currentWorkerIndex + 1) % workerPool.length;
    
    return worker;
}


// Function to simulate sensor data at an interval
function setOrUpdateInterval(sensor) {
    if (sensorIntervals[sensor._id]) {
        clearInterval(sensorIntervals[sensor._id]);
    }

    sensorIntervals[sensor._id] = setInterval(async () => {
        try {
            const result = await simulateSensorWithWorker(sensor);

            // Update the sensor in the main thread
            sensor.currentValue = result.newValue;
            await sensor.save();

            // Notify all clients about the new sensor value
            io.emit('sensor-added', { sensorId: sensor._id, newValue: result.newValue });
        } catch (err) {
            console.error('Error simulating sensor data:', err);
        }
    }, sensor.updateInterval * 1000);
}

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

io.on('connection', socket => {
    socket.on('fetch-sensors', async (userId) => {
        try {
            const sensors = await Sensor.find({ user: userId });
            socket.emit('sensors-list', sensors);
        } catch (error) {
            socket.emit('error', 'Errore nel recupero dei sensori');
        }
    });

    socket.on('delete-sensor', async (id) => {
        try {
            const sensor = await Sensor.findByIdAndDelete(id);
            if (!sensor) {
                socket.emit('sensor-delete-failed', 'Sensore non trovato');
                return;
            }
            clearInterval(sensorIntervals[id]);
            delete sensorIntervals[id];
            io.emit('sensor-added', { message: 'Sensore eliminato', id: id });
        } catch (error) {
            socket.emit('error', 'Errore durante l\'eliminazione del sensore');
        }
    });

    socket.on('add-sensor', async (data) => {
        const { user, name, type, updateInterval } = data;
        const sensor = new Sensor({ user, name, type, updateInterval });
        try {
            await sensor.save();
            setOrUpdateInterval(sensor);
            io.emit('sensor-added', sensor);
        } catch (error) {
            socket.emit('error', 'Errore nell\'aggiunta del sensore');
        }
    });

    socket.on('update-sensor', async (data) => {
        const { id, name, type, updateInterval } = data;
        try {
            const sensor = await Sensor.findByIdAndUpdate(id, { name, type, updateInterval }, { new: true });
            if (!sensor) {
                socket.emit('update-failed', 'Sensore non trovato');
                return;
            }
            setOrUpdateInterval(sensor);
            io.emit('sensor-updated', sensor);
        } catch (error) {
            socket.emit('error', "Errore durante l'aggiornamento del sensore");
        }
    });
});

// Start sensor simulation for all sensors
function startSensorSimulation() {
    Sensor.find({}).then(sensors => {
        sensors.forEach(sensor => {
            setOrUpdateInterval(sensor);
        });
    }).catch(err => {
        console.error('Errore durante il recupero dei sensori:', err);
    });
}

startSensorSimulation(); // Start simulation on server start

initializeWorkerPool(); // Initialize the worker pool

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
