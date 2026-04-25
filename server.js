'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Room, generateRoomCode } = require('./game/room');
const { getHighscores } = require('./game/highscores');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serve stickers
app.use('/stickers', express.static(path.join(__dirname, 'stickers')));

// REST: highscores
app.get('/api/highscores', (req, res) => {
  res.json(getHighscores());
});

// ---------------------------------------------------------------------------
// Room registry
// ---------------------------------------------------------------------------
const rooms = {}; // roomCode -> Room

function createRoom() {
  let code = generateRoomCode();
  // Ensure unique (extremely unlikely collision but be safe)
  let attempts = 0;
  while (rooms[code] && attempts < 20) {
    code = generateRoomCode();
    attempts++;
  }
  const room = new Room(io);
  room.roomCode = code;
  rooms[code] = room;
  return room;
}

function cleanupRoom(room) {
  if (room.players.length === 0) {
    room.stop();
    delete rooms[room.roomCode];
  }
}

function findRoomBySocket(socketId) {
  return Object.values(rooms).find(r =>
    r.players.some(p => p.socketId === socketId)
  );
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[+] connect ${socket.id}`);

  // --------------------------------------------------------------------------
  // room:create
  // --------------------------------------------------------------------------
  socket.on('room:create', ({ playerName } = {}, callback) => {
    const room = createRoom();
    const player = room.addPlayer(socket.id, playerName || 'Captain');
    socket.join(room.roomCode);

    console.log(`[room] created ${room.roomCode} by ${player.name}`);

    if (typeof callback === 'function') {
      callback({ roomCode: room.roomCode, playerId: player.id, role: player.role });
    }
  });

  // --------------------------------------------------------------------------
  // room:join
  // --------------------------------------------------------------------------
  socket.on('room:join', ({ roomCode, playerName } = {}, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found.' });
      return;
    }

    if (room.players.length >= 2) {
      // Check if this is a rejoin (same name + role slot open)
      if (typeof callback === 'function') callback({ error: 'Room is full.' });
      return;
    }

    const player = room.addPlayer(socket.id, playerName || 'Rookie');
    socket.join(code);

    console.log(`[room] ${player.name} joined ${code} as ${player.role}`);

    // Notify other player
    socket.to(code).emit('room:playerJoined', { playerName: player.name, role: player.role });

    if (typeof callback === 'function') {
      callback({ playerId: player.id, role: player.role, roles: room.getRoles() });
    }
  });

  // --------------------------------------------------------------------------
  // game:start
  // --------------------------------------------------------------------------
  socket.on('game:start', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    // Only host (first player, pilot) can start
    if (player && player.role === 'pilot') {
      if (room.players.length < 2) {
        socket.emit('game:event', { type: 'info', message: 'Waiting for second player to join.' });
        return;
      }
      room.startGame();
      console.log(`[game] start ${room.roomCode}`);
    }
  });

  // --------------------------------------------------------------------------
  // game:restart
  // --------------------------------------------------------------------------
  socket.on('game:restart', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    room.restartGame();
    console.log(`[game] restart ${room.roomCode}`);
  });

  // --------------------------------------------------------------------------
  // input:pilot
  // --------------------------------------------------------------------------
  socket.on('input:pilot', (input) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== 'pilot') return;
    room.pilotInput = {
      up:    !!input.up,
      down:  !!input.down,
      left:  !!input.left,
      right: !!input.right
    };
  });

  // --------------------------------------------------------------------------
  // input:gunner
  // --------------------------------------------------------------------------
  socket.on('input:gunner', (input) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== 'gunner') return;
    room.gunnerInput = {
      aimX:         typeof input.aimX === 'number' ? Math.max(0, Math.min(1, input.aimX)) : 0.5,
      aimY:         typeof input.aimY === 'number' ? Math.max(0, Math.min(1, input.aimY)) : 0.5,
      shooting:     !!input.shooting,
      holdingRepair: !!input.holdingRepair
    };
  });

  // --------------------------------------------------------------------------
  // disconnect
  // --------------------------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(`[-] disconnect ${socket.id}`);
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const removed = room.removePlayer(socket.id);
    if (removed) {
      socket.to(room.roomCode).emit('room:playerLeft', { role: removed.role });
      console.log(`[room] ${removed.name} left ${room.roomCode}`);
      // Clean up empty rooms
      setTimeout(() => cleanupRoom(room), 61000); // after 61s (disconnect hold + 1s)
    }
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Cosmic Delivery Co. running on http://localhost:${PORT}`);
});

module.exports = { app, server };
