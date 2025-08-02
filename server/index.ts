// server/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

const players: { [id: string]: Player } = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Add new player
  players[socket.id] = {
    id: socket.id,
    position: [0, 1, 0], // Start position
    rotation: [0, 0, 0],
  };

  // Send the current list of players to the new player
  socket.emit('currentPlayers', players);

  // Inform other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Handle player movement
  socket.on('playerMove', (data: { position: [number, number, number], rotation: [number, number, number] }) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      // Broadcast the movement to other players
      socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
    }
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    // Inform other players that this player has disconnected
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`✅ FPS WebSocket server is running on http://localhost:${PORT}`);
});
