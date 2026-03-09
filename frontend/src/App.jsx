/**
 * King of Diamonds (AIB) - Main Application Component
 * Manages the high-level game screens using a state-based routing system.
 */
import React, { useState, useEffect } from 'react';
import { useGame } from './context/GameContext';
import { Users, Play, Trophy, AlertTriangle, Clock, Skull, Loader2, Copy, Check, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { gameState, error, setError, notification } = useGame();

  return (
    <div className="App">
      <div className="game-container">
        <AnimatePresence mode="wait">
          {notification && (
            <motion.div 
              key="notif"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="notification-banner"
            >
              {notification}
            </motion.div>
          )}

          {error && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="error-banner"
            >
              <AlertTriangle size={20} />
              <span style={{flex: 1}}>{error}</span>
              <button onClick={() => setError('')} className="error-close">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {gameState === 'HOME' && <Home key="home" />}
          {gameState === 'LOBBY' && <Lobby key="lobby" />}
          {gameState === 'PLAYING' && <GameScreen key="playing" />}
          {gameState === 'RESULTS' && <Results key="results" />}
          {gameState === 'GAME_OVER' && <GameOver key="gameover" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Home Screen
 * Handles room creation and joining.
 */
const Home = () => {
  const { connect, isConnecting } = useGame();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !code) return;
    connect(code.toUpperCase(), name);
  };

  const handleCreate = () => {
    if (!name) return;
    connect('CREATE', name);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="animate-fade-in-up"
    >
      <div className="title-glow">
        <span className="diamond">♦</span>
        <h1>Number Game</h1>
        <span className="diamond">♦</span>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>In-Game Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arisu" maxLength={20} required />
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
          className="btn btn-secondary" 
          disabled={isConnecting}
        >
          {isConnecting ? (
            <div className="flex-center-gap">
              <Loader2 className="animate-spin" size={18} />
              Connecting...
            </div>
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
  const [copied, setCopied] = useState(false);
  const isHost = players.find(p => p.name === playerName)?.isHost;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="animate-fade-in-up"
    >
      <div className="text-center">
        <label className="text-muted" style={{fontSize: '0.7rem'}}>Game Lobby</label>
        <div className="code-display-wrap">
          <div className="room-code-box">
            <h2 className="room-code">{roomCode}</h2>
          </div>
          <button className="btn-copy" onClick={copyCode} title="Copy Code">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      <div className="player-list">
        <label className="text-muted">Citizens ({players.length}/8)</label>
        {players.map((p, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`player-row ${p.name === playerName ? 'me' : ''}`}
          >
            <div className="player-info">
              <Users size={16} className="text-muted" />
              <span className="player-name">{p.name} {p.name === playerName && '(You)'}</span>
              {p.isHost && <span className="host-badge">HOST</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-2">
        {isHost ? (
          players.length >= 3 ? (
            <button onClick={startGame} className="btn btn-primary">
              Start Match
            </button>
          ) : (
            <button className="btn btn-waiting" disabled>
              Waiting for Players (Min 3)
            </button>
          )
        ) : (
          <div className="text-center p-2 text-muted animate-pulse" style={{letterSpacing: '0.1em', fontSize: '0.8rem'}}>
            Waiting for Host to start
          </div>
        )}
      </div>
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
      const finalNum = selectedNum !== null ? selectedNum : Math.floor(Math.random() * 100) + 1;
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
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="game-screen animate-fade-in-up"
    >
      <div className="game-stats-header">
        <div className="stat-item">
          <div className="timer-label">Round</div>
          <div className="timer-value" style={{fontSize: '1.2rem'}}>{currentRound}</div>
        </div>
        <div className="timer-box">
          <div className="timer-label" style={{color: timer <= 10 ? 'var(--primary-red)' : 'var(--text-muted)'}}>
            Time Remaining
          </div>
          <div className="timer-value">{timer}</div>
        </div>
        <div className="stat-item" style={{textAlign: 'right'}}>
          <div className="timer-label">Submitted</div>
          <div className="timer-value" style={{fontSize: '1.2rem'}}>{submissionProgress.count}/{submissionProgress.total}</div>
        </div>
      </div>

      <div className="text-center mb-2">
        <div className="timer-label">Your Selection</div>
        <h2 className="room-code" style={{color: selectedNum ? 'var(--primary-red)' : 'var(--text-muted)', fontSize: '2.5rem'}}>
          {selectedNum !== null ? selectedNum : '--'}
        </h2>
      </div>
      
      <div className="number-grid">
        {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
          <div
            key={num}
            className={`grid-cell ${selectedNum === num ? 'selected' : ''} ${submitted ? 'locked' : ''}`}
            onClick={() => !submitted && setSelectedNum(num)}
          >
            {num}
          </div>
        ))}
      </div>

      <button 
        onClick={handleSubmit} 
        disabled={submitted || selectedNum === null} 
        className={`btn ${submitted ? 'btn-secondary' : 'btn-primary'}`}
      >
        {getButtonContent()}
      </button>

      <div className="player-list">
        <label className="text-muted">Active Players ({activeCount})</label>
        {players.filter(p => !p.isEliminated).map((p, idx) => (
          <div key={idx} className="player-row" style={{padding: '8px 15px'}}>
            <div className="player-info">
              <span className="player-name">{p.name} {p.name === playerName && '(You)'}</span>
            </div>
            <div className="player-score">{p.score}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * Eliminated Screen
 * Dramatic feedback when a player's score drops to -10.
 */
const EliminatedScreen = ({ score, round }) => (
  <div className="text-center animate-fade-in-up">
    <Skull size={64} className="text-primary mb-2" />
    <h1 className="title-glow">Game Over</h1>
    <h2 style={{color: 'var(--primary-red)'}}>ELIMINATED</h2>
    <p className="text-muted mt-2">You survived until Round {round}</p>
    <div className="mt-2 text-center">
      <div className="timer-label">Final Score</div>
      <div className="timer-value" style={{fontSize: '2.5rem'}}>{score}</div>
    </div>
  </div>
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
  const { lastResults, cooldownTimer, currentRound } = useGame();
  if (!lastResults) return null;

  return (
    <div className="results-container animate-fade-in-up">
      <div className="text-center mb-2">
        <h2 className="title-glow">Round {currentRound} Results</h2>
        <div className="target-banner">
          <label className="text-muted">Target Number</label>
          <div className="timer-value">{lastResults.target}</div>
          {lastResults.exactHit && (
            <div className="host-badge" style={{marginTop: '10px', background: 'gold', color: 'black'}}>
              EXACT HIT BY {lastResults.exactWinner}!
            </div>
          )}
        </div>
      </div>

      <table className="sleek-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pick</th>
            <th>Penalty</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {lastResults.players.map((p, idx) => (
            <tr key={idx} className={`sleek-row ${p.isWinner ? 'winner-row' : ''}`}>
              <td>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  {p.isWinner && <Trophy size={14} style={{color: 'gold'}} />}
                  {p.name}
                  {p.isAutoSubmitted && <span className="text-muted" style={{fontSize: '0.6rem'}}>(BOT)</span>}
                </div>
              </td>
              <td>{p.value}</td>
              <td style={{color: p.change < 0 ? '#ff4d4d' : '#4dff4d'}}>
                {p.change > 0 ? `+${p.change}` : p.change}
                {p.penaltyDescription && <div style={{fontSize: '0.6rem', opacity: 0.7}}>{p.penaltyDescription}</div>}
              </td>
              <td className="player-score">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 text-center">
        <div className="timer-label">Next Round in</div>
        <div className="timer-value">{cooldownTimer}</div>
      </div>
    </div>
  );
};

/**
 * Game Over Screen
 * Victory announcement for the final survivor.
 */
const GameOver = () => {
  const { winner } = useGame();

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center animate-fade-in-up"
    >
      <Trophy size={64} className="text-primary mb-2" style={{color: 'gold', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))'}} />
      <h1 className="mb-1 title-glow">Game Over</h1>
      <p className="mb-2" style={{fontSize: '1.2rem'}}>Winner: <span className="text-primary" style={{color: 'gold', fontWeight: 900}}>{winner}</span></p>
      <button onClick={() => window.location.reload()} className="btn btn-primary">
        Return Home
      </button>
    </motion.div>
  );
};

export default App;
