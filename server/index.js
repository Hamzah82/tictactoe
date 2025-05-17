const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

const rooms = {};
const roomPlayers = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('createRoom', (roomId) => {
    rooms[roomId] = {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      gameOver: false
    };
    roomPlayers[socket.id] = roomId;
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId] && rooms[roomId].players.length < 2) {
      rooms[roomId].players.push(socket.id);
      roomPlayers[socket.id] = roomId;
      socket.join(roomId);
      socket.emit('roomJoined', roomId);
      io.to(roomId).emit('playerJoined', rooms[roomId].players.length);
      
      // Start game if 2 players
      if (rooms[roomId].players.length === 2) {
        io.to(roomId).emit('gameStarted', { 
          currentPlayer: rooms[roomId].currentPlayer,
          board: rooms[roomId].board
        });
      }
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('makeMove', ({ roomId, cellIndex }) => {
    const room = rooms[roomId];
    if (!room || room.gameOver || room.board[cellIndex] !== null) return;
    
    const playerSymbol = room.players[0] === socket.id ? 'X' : 'O';
    if (playerSymbol !== room.currentPlayer) return;
    
    room.board[cellIndex] = playerSymbol;
    
    // Check for winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      io.to(roomId).emit('gameOver', { winner, board: room.board });
      return;
    }
    
    // Check for draw
    if (!room.board.includes(null)) {
      room.gameOver = true;
      io.to(roomId).emit('gameOver', { winner: 'draw', board: room.board });
      return;
    }
    
    // Switch player
    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
    io.to(roomId).emit('moveMade', { 
      board: room.board, 
      currentPlayer: room.currentPlayer 
    });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    const roomId = roomPlayers[socket.id];
    if (roomId && rooms[roomId]) {
      const index = rooms[roomId].players.indexOf(socket.id);
      if (index !== -1) {
        rooms[roomId].players.splice(index, 1);
        io.to(roomId).emit('playerLeft');
      }
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      }
    }
    delete roomPlayers[socket.id];
  });
});

function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});