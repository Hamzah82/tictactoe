const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: [
    'https://tictachamzz82.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://tictachamzz82.vercel.app',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 menit
    skipMiddlewares: true
  },
  pingTimeout: 60000, // 60 detik
  pingInterval: 25000 // 25 detik
});

const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/api/server', (req, res) => {
  res.status(200).json({
    status: 'running',
    message: 'Tic Tac Toe Server is online',
    timestamp: new Date().toISOString(),
    activeRooms: Object.keys(rooms).length
  });
});

const rooms = {};
const roomPlayers = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Handle reconnection
  socket.on('reconnect_attempt', () => {
    console.log(`Reconnecting: ${socket.id}`);
  });

  socket.on('createRoom', (roomId) => {
    if (rooms[roomId]) {
      socket.emit('roomExists');
      return;
    }

    rooms[roomId] = {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      gameOver: false,
      createdAt: Date.now()
    };
    
    roomPlayers[socket.id] = roomId;
    socket.join(roomId);
    
    console.log(`Room created: ${roomId}`);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('invalidRoom');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('roomFull');
      return;
    }

    room.players.push(socket.id);
    roomPlayers[socket.id] = roomId;
    socket.join(roomId);
    
    console.log(`Player joined: ${socket.id} to ${roomId}`);
    socket.emit('roomJoined', roomId);
    
    io.to(roomId).emit('playerJoined', {
      playerCount: room.players.length,
      roomId
    });

    if (room.players.length === 2) {
      io.to(roomId).emit('gameStarted', {
        currentPlayer: room.currentPlayer,
        board: room.board
      });
    }
  });

  socket.on('makeMove', ({ roomId, cellIndex }) => {
    const room = rooms[roomId];
    if (!room || room.gameOver) return;

    const playerSymbol = room.players[0] === socket.id ? 'X' : 'O';
    if (playerSymbol !== room.currentPlayer || room.board[cellIndex] !== null) return;

    room.board[cellIndex] = playerSymbol;
    
    // Check winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      io.to(roomId).emit('gameOver', { 
        winner, 
        board: room.board,
        winningCells: getWinningCells(room.board)
      });
      return;
    }

    // Check draw
    if (!room.board.includes(null)) {
      room.gameOver = true;
      io.to(roomId).emit('gameOver', { 
        winner: 'draw', 
        board: room.board 
      });
      return;
    }

    // Switch player
    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
    io.to(roomId).emit('moveMade', { 
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  socket.on('resetGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
    room.gameOver = false;
    
    io.to(roomId).emit('gameReset', {
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    const roomId = roomPlayers[socket.id];
    
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      const index = room.players.indexOf(socket.id);
      
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit('playerLeft', {
          playerId: socket.id,
          remainingPlayers: room.players.length
        });
      }
      
      if (room.players.length === 0) {
        // Cleanup empty room after 5 menit
        setTimeout(() => {
          if (rooms[roomId]?.players.length === 0) {
            delete rooms[roomId];
            console.log(`Room cleaned: ${roomId}`);
          }
        }, 5 * 60 * 1000);
      }
    }
    
    delete roomPlayers[socket.id];
  });
});

// Helper functions
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (const [a, b, c] of winPatterns) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getWinningCells(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return pattern;
    }
  }
  return [];
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/server`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});