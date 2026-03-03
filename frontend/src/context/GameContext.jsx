import React, { createContext, useContext, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('HOME');
  const [currentRound, setCurrentRound] = useState(0);
  const [timer, setTimer] = useState(30);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [lastResults, setLastResults] = useState(null);
  const [submissionProgress, setSubmissionProgress] = useState({ count: 0, total: 0 });
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');

  const connect = useCallback((code, name) => {
    const newSocket = io(`http://${window.location.hostname}:8000`);
    
    newSocket.on('connect', () => {
      newSocket.emit('join', { code, name });
      setSocket(newSocket);
      setRoomCode(code);
      setPlayerName(name);
    });

    newSocket.on('room_update', (data) => {
      setPlayers(data.players);
      if (gameState === 'HOME') setGameState('LOBBY');
    });

    newSocket.on('game_started', () => {
      setGameState('PLAYING');
    });

    newSocket.on('round_start', (data) => {
      setCurrentRound(data.round);
      setTimer(data.timer);
      setCooldownTimer(0);
      setSubmissionProgress({ count: 0, total: 0 });
      setGameState('PLAYING');
    });

    newSocket.on('submission_update', (data) => {
      setSubmissionProgress(data);
    });

    newSocket.on('timer_tick', (data) => {
      setTimer(data.timer);
    });

    newSocket.on('cooldown_tick', (data) => {
      setCooldownTimer(data.timer);
    });

    newSocket.on('round_results', (data) => {
      setLastResults(data.results);
      setGameState('RESULTS');
    });

    newSocket.on('game_over', (data) => {
      setWinner(data.winner);
      setGameState('GAME_OVER');
    });

    newSocket.on('error_msg', (msg) => {
      setError(msg);
    });

    newSocket.on('disconnect', () => {
      setSocket(null);
      setGameState('HOME');
    });

    return () => newSocket.close();
  }, [gameState]);

  const startGame = () => {
    if (socket) socket.emit('start_game');
  };

  const submitNumber = (value) => {
    if (socket) socket.emit('submit_number', value);
  };

  return (
    <GameContext.Provider value={{
      socket, roomCode, playerName, players, gameState, currentRound, timer, cooldownTimer, lastResults, submissionProgress, winner, error,
      connect, startGame, submitNumber, setError
    }}>
      {children}
    </GameContext.Provider>
  );
};
