/**
 * King of Diamonds (AIB) - Main Application Component
 * Manages the high-level game screens using a state-based routing system.
 */
import React, { useState, useEffect } from 'react';
import { useGame } from './context/GameContext';
import { Users, Play, Trophy, AlertTriangle, Clock, Skull, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { gameState, error, setError } = useGame();

  return (
    <div className="app-container">
      {/* Global Error Toast Notification */}
      {error && (
        <div className="error-toast" onClick={() => setError('')}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      
      {/* State-based routing with smooth transitions between screens */}
      <AnimatePresence mode="wait">
        {gameState === 'HOME' && <Home key="home" />}
        {gameState === 'LOBBY' && <Lobby key="lobby" />}
        {gameState === 'PLAYING' && <GameScreen key="game" />}
        {gameState === 'RESULTS' && <Results key="results" />}
        {gameState === 'GAME_OVER' && <GameOver key="over" />}
      </AnimatePresence>
    </div>
  );
}

/**
 * Home Screen
 * Handles room creation and joining.
 */
const Home = () => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const { connect, isConnecting } = useGame();

  const handleJoin = (e) => {
    e.preventDefault();
    if (name && code) connect(code.toUpperCase(), name);
  };

  const handleCreate = () => {
    if (!name) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    connect(newCode, name);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card">
      <h1 className="title">Number Game</h1>
      <form onSubmit={handleJoin}>
        <div className="input-group">
          <label>Player Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Arisu" required />
        </div>
        <div className="input-group">
          <label>Room Code</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="X8B2L1" />
        </div>
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={isConnecting}
        >
          Join Game
        </button>
        <button 
          type="button" 
          onClick={handleCreate} 
          className={`btn btn-secondary ${isConnecting ? 'flex-center-gap' : ''}`} 
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Connecting to server...
            </>
          ) : (
            'Create Room'
          )}
        </button>
      </form>
    </motion.div>
  );
};

/**
 * Lobby Screen
 * Displays waiting players and allows the host to start the game.
 */
const Lobby = () => {
  const { roomCode, players, playerName, startGame } = useGame();
  const isHost = players.find(p => p.name === playerName)?.isHost;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card">
      <h2 className="title">Room: {roomCode}</h2>
      <div className="input-group">
        <label>Players ({players.length}/8)</label>
        <div className="player-list">
          {players.map(p => (
            <div key={p.name} className={`player-item ${!p.isActive ? 'eliminated' : ''}`}>
              <span>{p.name} {p.isHost && '(Host)'}</span>
              <span className="score">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
      {isHost ? (
        <button 
          onClick={startGame} 
          disabled={players.length < 3} 
          className="btn btn-primary"
        >
          {players.length < 3 ? 'Waiting for Players (min 3)' : 'Start Game'}
        </button>
      ) : (
        <div className="text-dim text-center">Waiting for host to start...</div>
      )}
    </motion.div>
  );
};

/**
 * Game Screen
 * The main interactive screen where players pick numbers from the grid.
 */
const GameScreen = () => {
  const [selectedNum, setSelectedNum] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const { timer, submitNumber, currentRound, players, playerName, submissionProgress, gameState } = useGame();
  
  const player = players.find(p => p.name === playerName);
  const activeCount = players.filter(p => !p.isEliminated).length;

  // Effect: Auto-submit current selection or random number when timer hits 0
  useEffect(() => {
    if (timer === 0 && !submitted && !player?.isEliminated) {
      const finalNum = selectedNum !== null ? selectedNum : Math.floor(Math.random() * 101);
      submitNumber(finalNum);
      setSubmitted(true);
      setIsAuto(true);
    }
  }, [timer, selectedNum, submitted, submitNumber, player?.isEliminated]);

  // Effect: Reset local selection state for each new round
  useEffect(() => {
    if (gameState === 'PLAYING') {
      setSubmitted(false);
      setIsAuto(false);
      setSelectedNum(null);
    }
  }, [currentRound, gameState]);

  // Handle Spectator/Eliminated Views
  if (player?.isEliminated) {
    if (player.eliminatedInRound === currentRound) {
      return <EliminatedScreen score={player.score} round={player.eliminatedInRound} />;
    }
    return <SpectatorScreen round={currentRound} activeCount={activeCount} />;
  }

  const handleSubmit = () => {
    if (selectedNum !== null) {
      submitNumber(selectedNum);
      setSubmitted(true);
    }
  };

  const getButtonContent = () => {
    if (isAuto) return "Auto-submitted";
    if (submitted) return "Submitted ✓";
    return selectedNum === null ? "Select a Number" : "Submit Number";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card" style={{ maxWidth: '500px' }}>
      <div className="flex-between">
        <span className="text-dim">Round {currentRound}</span>
        <Clock size={20} className="text-red" />
      </div>
      <div className="timer">{timer}</div>
      <div className="text-center mb-1 text-dim">
        {submissionProgress.count}/{submissionProgress.total} players submitted
      </div>

      <div className="grid-container">
        <div className="selected-display">
          YOUR NUMBER: <span className="text-red">{selectedNum !== null ? selectedNum : '--'}</span>
        </div>
        
        {/* Number Selection Grid (0-100) */}
        <div className={`number-grid ${submitted ? 'disabled' : ''}`}>
          {Array.from({ length: 101 }, (_, i) => i).map(num => (
            <div
              key={num}
              className={`grid-cell ${selectedNum === num ? 'selected' : ''} ${submitted ? 'locked' : ''}`}
              onClick={() => !submitted && setSelectedNum(num)}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSubmit} 
        className={`btn ${submitted ? 'btn-success' : 'btn-primary'}`} 
        disabled={submitted || selectedNum === null}
      >
        {getButtonContent()}
      </button>
    </motion.div>
  );
};

/**
 * Eliminated Screen
 * Dramatic feedback when a player's score drops to -10.
 */
const EliminatedScreen = ({ score, round }) => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    className="elimination-screen"
  >
    <div className="elimination-title">YOU HAVE BEEN<br/>ELIMINATED</div>
    <div className="text-white text-xl mb-4 font-bold">Final Score: {score}</div>
    <div className="text-dim uppercase tracking-widest text-sm">Eliminated in Round {round}</div>
    <p className="mt-8 text-dim max-w-xs">You have failed the game of survival. You are now a spectator.</p>
  </motion.div>
);

/**
 * Spectator Screen
 * Passive view for players who are already eliminated while game is running.
 */
const SpectatorScreen = ({ round, activeCount }) => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    className="card spectator-screen text-center"
  >
    <div className="pulsing-dot mb-4"></div>
    <h2 className="title mb-1">ROUND {round} IN PROGRESS</h2>
    <p className="text-dim mb-6">Waiting for active players to submit...</p>
    
    <div className="flex gap-8 mt-4">
      <div className="text-center">
        <div className="text-gold text-2xl font-bold">{activeCount}</div>
        <div className="spectator-stat">Players Left</div>
      </div>
      <div className="text-center">
        <div className="text-red text-2xl font-bold">--</div>
        <div className="spectator-stat">Your Status</div>
      </div>
    </div>
  </motion.div>
);

/**
 * Results Screen
 * Detailed breakdown of the round (Average, Target, Scores).
 */
const Results = () => {
  const { lastResults, cooldownTimer } = useGame();
  if (!lastResults) return null;

  const sortedPlayers = [...lastResults.players].sort((a, b) => b.score - a.score);
  const closestPlayer = lastResults.players.find(p => p.isWinner);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card" style={{ maxWidth: '600px' }}>
      <h2 className="title">Round Results</h2>
      
      <div className="target-banner text-center">
        <div className="text-dim text-sm uppercase tracking-widest mb-1">Target Number</div>
        <div className="timer" style={{ fontSize: '2.5rem', margin: '0' }}>{lastResults.target}</div>
        <div className="text-dim text-xs mt-1">Average: {lastResults.average}</div>
        <div className="closest-badge">
          Closest: {closestPlayer?.name} ({closestPlayer?.value})
        </div>
        {lastResults.exactHit && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500 rounded text-red shadow-[0_0_15px_rgba(255,0,0,0.3)] animate-bounce">
            🎯 EXACT NUMBER HIT by {lastResults.exactWinner}! <br/>
            <span className="text-xs font-bold">ALL OTHERS -2 POINTS</span>
          </div>
        )}
      </div>

      {cooldownTimer > 0 && (
        <div className="text-center text-red font-bold mb-4 animate-pulse">
          Next round in {cooldownTimer}s...
        </div>
      )}

      {/* Scoreboard Table */}
      <table className="scoreboard-table">
        <thead>
          <tr className="text-dim text-xs uppercase text-left">
            <th style={{ padding: '0 12px 8px' }}>Player</th>
            <th style={{ padding: '0 12px 8px' }}>Pick</th>
            <th style={{ padding: '0 12px 8px' }}>Change</th>
            <th style={{ padding: '0 12px 8px' }} className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p, index) => (
            <motion.tr 
              key={p.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`scoreboard-row ${p.isWinner ? 'winner-highlight' : ''} ${p.isEliminated ? 'eliminated-row' : ''}`}
            >
              <td>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.name}</span>
                  {p.isWinner && <Trophy size={14} className="text-gold" />}
                  {p.isEliminated && <Skull size={14} className="text-dim" />}
                </div>
              </td>
              <td>
                <div className="flex flex-col">
                  <span className="text-dim font-mono">{p.value}</span>
                  {p.isAutoSubmitted && (
                    <span className="text-[9px] text-red uppercase font-bold flex items-center gap-0.5">
                      ⏰ Auto-submitted
                    </span>
                  )}
                </div>
              </td>
              <td className={`score-change ${p.change < 0 ? 'text-red' : 'text-gold'}`}>
                <div className="flex flex-col">
                  <span>{p.change > 0 ? `+${p.change}` : p.change === 0 ? '--' : p.change}</span>
                  {p.disqualified && (
                    <span className="text-[10px] text-red uppercase font-bold flex items-center gap-1">
                      <AlertTriangle size={10} /> Duplicate
                    </span>
                  )}
                  {p.penaltyDescription && !p.disqualified && (
                    <span className="text-[10px] text-red uppercase font-bold">
                      {p.penaltyDescription}
                    </span>
                  )}
                </div>
              </td>
              <td className="text-right font-bold" style={{ color: p.score <= -8 ? 'var(--primary-red)' : 'inherit' }}>
                {p.score}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

/**
 * Game Over Screen
 * Victory announcement for the final survivor.
 */
const GameOver = () => {
  const { winner } = useGame();
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card text-center">
      <Trophy className="text-gold mx-auto mb-1" size={64} style={{ color: '#ffd700' }} />
      <h1 className="title">Citizen WINS</h1>
      <h2 className="winner-name text-gold">{winner}</h2>
      <p className="text-dim mt-2">Game Over</p>
      <button onClick={() => window.location.reload()} className="btn btn-secondary mt-2">Back Home</button>
    </motion.div>
  );
};

export default App;

