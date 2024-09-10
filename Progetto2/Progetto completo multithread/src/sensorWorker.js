// sensorWorker.js
const { parentPort, threadId } = require('worker_threads');

parentPort.on('message', (sensorData) => {
    // Log the threadId and sensor being handled
    console.log(`Worker ${threadId} is handling sensor ${sensorData._id}`);

    // Simulate sensor data
    const simulatedValue = Math.random() * 100;

    // Send the result back to the main thread
    parentPort.postMessage({ 
        sensorId: sensorData._id, 
        newValue: simulatedValue, 
        workerId: threadId // Send the threadId back as well
    });
});
