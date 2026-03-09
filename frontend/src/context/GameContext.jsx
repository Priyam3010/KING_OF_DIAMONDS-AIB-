/**
 * Game Context Provider
 * manages the global game state, socket connection, and real-time events.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext();

/**
 * Hook to access the game state and methods.
 */
export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('HOME'); // HOME, LOBBY, PLAYING, RESULTS, GAME_OVER
  const [currentRound, setCurrentRound] = useState(0);
  const [timer, setTimer] = useState(30);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [lastResults, setLastResults] = useState(null);
  const [submissionProgress, setSubmissionProgress] = useState({ count: 0, total: 0 });
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  /**
   * connect: Initializes socket connection to backend and sets up event listeners.
   * Now includes retry logic: 5 attempts with 3s intervals.
   * @param {string} code - Room code
   * @param {string} name - Player name
   */
  const connect = useCallback((code, name) => {
    setIsConnecting(true);
    let attempts = 0;
    const maxAttempts = 5;
    let socketInstance = null;

    const attemptConnection = () => {
      attempts++;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://king-of-diamonds-aib-8ske.onrender.com";
      
      // Close previous instance if it exists
      if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.close();
      }

      socketInstance = io(backendUrl, {
        reconnection: false, // We'll handle retries manually for better UI control
        timeout: 3000
      });

      socketInstance.on('connect', () => {
        setIsConnecting(false);
        setError('');
        socketInstance.emit('join', { code, name });
        setSocket(socketInstance);
        setRoomCode(code);
        setPlayerName(name);
      });

      socketInstance.on('connect_error', () => {
        if (attempts < maxAttempts) {
          setError(`Connection failed. Retrying... (${attempts}/${maxAttempts})`);
          setTimeout(attemptConnection, 3000);
        } else {
          setIsConnecting(false);
          setError("Failed to connect to server after 5 attempts. Please check your internet or try again later.");
        }
      });

      // Listeners for Backend Events
      socketInstance.on('room_update', (data) => {
        setPlayers(data.players);
        // Automatically move to Lobby upon successful join
        setGameState(prev => prev === 'HOME' ? 'LOBBY' : prev);
      });

      socketInstance.on('game_started', () => {
        setGameState('PLAYING');
      });

      socketInstance.on('round_start', (data) => {
        setCurrentRound(data.round);
        setTimer(data.timer);
        setCooldownTimer(0);
        setSubmissionProgress({ count: 0, total: 0 });
        setGameState('PLAYING');
      });

      socketInstance.on('submission_update', (data) => {
        setSubmissionProgress(data);
      });

      socketInstance.on('timer_tick', (data) => {
        setTimer(data.timer);
      });

      socketInstance.on('cooldown_tick', (data) => {
        setCooldownTimer(data.timer);
      });

      socketInstance.on('round_results', (data) => {
        setLastResults(data.results);
        setGameState('RESULTS');
      });

      socketInstance.on('game_over', (data) => {
        setWinner(data.winner);
        setGameState('GAME_OVER');
      });

      socketInstance.on('error_msg', (data) => {
        setError(typeof data === 'object' ? data.message : data);
      });

      socketInstance.on('error', (data) => {
        setError(typeof data === 'object' ? data.message : data);
      });

      socketInstance.on('disconnect', () => {
        setSocket(null);
        setGameState('HOME');
      });
    };

    attemptConnection();

    return () => {
      if (socketInstance) socketInstance.close();
    };
  }, []);

  /**
   * startGame: Sends signal to backend to start the game match.
   */
  const startGame = () => {
    if (socket) socket.emit('start_game');
  };

  /**
   * submitNumber: Sends the player's selection (0-100) to the logic engine.
   * @param {number} value
   */
  const submitNumber = (value) => {
    if (socket) socket.emit('submit_number', value);
  };

  return (
    <GameContext.Provider value={{
      socket, roomCode, playerName, players, gameState, currentRound, timer, cooldownTimer, lastResults, submissionProgress, winner, error, isConnecting,
      connect, startGame, submitNumber, setError
    }}>
      {children}
    </GameContext.Provider>
  );
};

