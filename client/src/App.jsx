import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [players, setPlayers] = useState(0);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('roomCreated', (roomId) => {
      setRoomId(roomId);
      setIsCreator(true);
    });

    newSocket.on('roomJoined', (roomId) => {
      setRoomId(roomId);
      setIsCreator(false);
    });

    newSocket.on('playerJoined', (playerCount) => {
      setPlayers(playerCount);
    });

    newSocket.on('gameStarted', ({ currentPlayer, board }) => {
      setCurrentPlayer(currentPlayer);
      setBoard(board);
    });

    newSocket.on('moveMade', ({ board, currentPlayer }) => {
      setBoard(board);
      setCurrentPlayer(currentPlayer);
    });

    newSocket.on('gameOver', ({ winner, board }) => {
      setBoard(board);
      setGameOver(true);
      setWinner(winner);
    });

    newSocket.on('playerLeft', () => {
      alert('Other player left the game. You win!');
      setGameOver(true);
      setWinner(isCreator ? 'X' : 'O');
    });

    newSocket.on('roomFull', () => {
      alert('Room is full!');
    });

    return () => newSocket.disconnect();
  }, []);

  const createRoom = () => {
    if (socket) {
      socket.emit('createRoom', Math.random().toString(36).substring(2, 8).toUpperCase());
    }
  };

  const joinRoom = () => {
    if (socket && inputRoomId.trim()) {
      socket.emit('joinRoom', inputRoomId.trim());
    }
  };

  const handleCellClick = (index) => {
    if (!gameOver && board[index] === null && socket && roomId) {
      socket.emit('makeMove', { roomId, cellIndex: index });
    }
  };

  const resetGame = () => {
    if (socket && roomId) {
      socket.emit('resetGame', roomId);
    }
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setWinner(null);
    setCurrentPlayer('X');
  };

  const renderCell = (index) => {
    return (
      <button
        className={`cell ${board[index]}`}
        onClick={() => handleCellClick(index)}
        disabled={gameOver || board[index] !== null}
      >
        {board[index]}
      </button>
    );
  };

  return (
    <div className="app">
      <h1>Tic Tac Toe Online</h1>
      
      {!roomId ? (
        <div className="room-actions">
          <button onClick={createRoom}>Create Room</button>
          <div className="join-room">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
            />
            <button onClick={joinRoom}>Join Room</button>
          </div>
        </div>
      ) : (
        <>
          <div className="game-info">
            <p>Room ID: {roomId}</p>
            <p>Players: {players}/2</p>
            {players === 2 && (
              <p>Current Turn: {currentPlayer} ({currentPlayer === (isCreator ? 'X' : 'O') ? 'You' : 'Opponent'})</p>
            )}
            {gameOver && (
              <p className="winner-message">
                {winner === 'draw' ? 'Game ended in a draw!' : `Player ${winner} wins!`}
              </p>
            )}
          </div>
          
          <div className="board">
            {Array(9).fill().map((_, index) => (
              <div key={index} className="cell-container">
                {renderCell(index)}
              </div>
            ))}
          </div>
          
          {gameOver && (
            <button className="reset-button" onClick={resetGame}>
              Play Again
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default App;