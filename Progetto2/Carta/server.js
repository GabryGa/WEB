const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
const rooms = {}; // memorizza le scelte dei giocatori per ogni stanza
 
app.use(express.static('public')); // Servire i file statici per il client
 
io.on('connection', (socket) => {
    console.log('Un utente si è connesso');
 
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`Utente ha unito la stanza ${room}`);
 
        if (!rooms[room]) {
            rooms[room] = {};
        }
 
        if (Object.keys(rooms[room]).length === 2) {
            io.to(room).emit('startGame');
        }
    });
 
    socket.on('makeMove', ({ room, move }) => {
        rooms[room][socket.id] = move;
 
        if (Object.keys(rooms[room]).length === 2) {
            const [firstPlayer, secondPlayer] = Object.keys(rooms[room]);
            const result = determineWinner(rooms[room][firstPlayer], rooms[room][secondPlayer]);
 
            io.to(room).emit('gameResult', {
                firstPlayerMove: rooms[room][firstPlayer],
                secondPlayerMove: rooms[room][secondPlayer],
                result,
            });
 
            // Resetta la stanza per il prossimo round
            rooms[room] = {};
        }
    });
 
    socket.on('disconnect', () => {
        console.log('Un utente si è disconnesso');
        // eventuale gestione per pulizia
    });
});
 
// Funzione per determinare il vincitore
function determineWinner(move1, move2) {
    if (move1 === move2) {
        return 'Pareggio';
    }
    if (
        (move1 === 'sasso' && move2 === 'forbice') ||
        (move1 === 'forbice' && move2 === 'carta') ||
        (move1 === 'carta' && move2 === 'sasso')
    ) {
        return 'Giocatore 1 vince';
    }
    return 'Giocatore 2 vince';
}
 
server.listen(3000, () => {
    console.log('Server in ascolto sulla porta 3000');
});
