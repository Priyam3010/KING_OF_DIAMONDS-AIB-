/**
 * King of Diamonds (AIB) - Backend Server
 * Handles real-time game logic using Socket.io and Express.
 * Version: 1.1.0 (Added documentation comments)
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');

const app = express();

/**
 * 1. General API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please wait a moment before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all Express routes
app.use(apiLimiter);

// Configure CORS for Express routes
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  }),
);

const server = http.createServer(app);

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * Custom Rate Limiters for Socket.io
 * Note: express-rate-limit is for Express middleware. 
 * We use simple memory-based tracking for sockets.
 */
const connectionAttempts = new Map();
const roomCreations = new Map();

// Cleanup maps periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of connectionAttempts.entries()) {
    if (now - data.startTime > 60000) connectionAttempts.delete(ip);
  }
  for (const [ip, data] of roomCreations.entries()) {
    if (now - data.startTime > 600000) roomCreations.delete(ip);
  }
}, 60000);

// Socket.io Middleware for Connection Rate Limiting
io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();
  
  if (!connectionAttempts.has(ip)) {
    connectionAttempts.set(ip, { count: 1, startTime: now });
  } else {
    const data = connectionAttempts.get(ip);
    if (now - data.startTime < 60000) {
      data.count++;
      if (data.count > 10) {
        return next(new Error("Too many requests, please wait a moment before trying again."));
      }
    } else {
      connectionAttempts.set(ip, { count: 1, startTime: now });
    }
  }
  next();
});

/**
 * Global Game State Storage
 * Key: Room Code (string)
 * Value: Room Object
 */
const rooms = {};

/**
 * Room Object Structure:
 * {
 *   code: string,
 *   isLocked: boolean (Game in progress),
 *   currentRound: number,
 *   players: { [socketId: string]: Player },
 *   submissions: { [roundNumber: number]: { [socketId: string]: number } },
 *   timer: IntervalID,
 *   timerValue: number
 * }
 *
 * Player Object Structure:
 * {
 *   id: string (socketId),
 *   name: string,
 *   score: number,
 *   isHost: boolean,
 *   isEliminated: boolean,
 *   isActive: boolean (Connection status)
 * }
 */

/**
 * main Socket.io connection handler
 */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  /**
   * Event: join
   * Handles player joining a room or reconnecting.
   * @param {Object} data - { code, name }
   */
  socket.on("join", ({ code, name }) => {
    const ip = socket.handshake.address;

    // 1. Username Validation
    const nameRegex = /^[a-zA-Z0-9 _-]+$/;
    if (
      typeof name !== 'string' ||
      name.length < 1 ||
      name.length > 20 ||
      !nameRegex.test(name)
    ) {
      return socket.emit('error', { message: 'Invalid username' });
    }

    let targetCode = code;

    // 2. Room ID Generation (if it's a creation attempt)
    // If code is empty, "CREATE", or specific for creation, generate a unique ID
    if (!targetCode || targetCode === 'CREATE') {
      targetCode = crypto.randomUUID().slice(0, 8).toUpperCase();
    }

    let room = rooms[targetCode];

    // Create room if it doesn't exist
    if (!room) {
      // Rate limit room creation: Max 5 per 10 minutes per IP
      const now = Date.now();
      if (!roomCreations.has(ip)) {
        roomCreations.set(ip, { count: 1, startTime: now });
      } else {
        const data = roomCreations.get(ip);
        if (now - data.startTime < 600000) {
          data.count++;
          if (data.count > 5) {
            return socket.emit("error_msg", "Too many requests, please wait a moment before trying again.");
          }
        } else {
          roomCreations.set(ip, { count: 1, startTime: now });
        }
      }

      room = {
        code: targetCode,
        isLocked: false,
        currentRound: 0,
        players: {},
        submissions: {},
      };
      rooms[targetCode] = room;
    }

    // Prevent joining if game has already started
    if (room.isLocked) {
      return socket.emit(
        "error_msg",
        "Game already in progress. This room is closed.",
      );
    }

    // Limit room capacity to 8 players
    const activePlayersCount = Object.values(room.players).filter(
      (p) => !p.isEliminated,
    ).length;
    if (activePlayersCount >= 8) {
      return socket.emit(
        "error_msg",
        "Room is full. Maximum 8 players allowed.",
      );
    }

    // Check if player name exists in room (for reconnection logic)
    let player = Object.values(room.players).find((p) => p.name === name);
    if (player) {
      // Reconnect: update socket ID and mark active
      delete room.players[player.id];
      player.id = socket.id;
      player.isActive = true;
      room.players[socket.id] = player;
    } else {
      // New Join: create player object
      player = {
        id: socket.id,
        name,
        score: 0,
        isHost: Object.keys(room.players).length === 0, // First player is host
        isEliminated: false,
        isActive: true,
      };
      room.players[socket.id] = player;
    }

    socket.join(targetCode);
    socket.roomCode = targetCode;
    socket.playerName = name;

    broadcastRoomUpdate(targetCode);
  });

  /**
   * Event: start_game
   * Initiates the game session (Only for Hosts).
   */
  socket.on("start_game", () => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    
    // Check if the current socket is actually the host
    if (!player || !player.isHost) {
      return socket.emit('error', { message: 'Only host can start game' });
    }

    const activePlayers = Object.values(room.players).filter(
      (p) => !p.isEliminated,
    );
    // Game requires minimum 3 players for balance
    if (activePlayers.length < 3) {
      return socket.emit("error", { message: "Minimum 3 players required to start." });
    }

    room.isLocked = true; // Lock room to prevent new joins
    io.to(room.code).emit("game_started");
    startNewRound(room.code);
  });

  /**
   * Event: submit_number
   * Registers a player's number choice for the current round.
   * @param {number} value - The number picked (0-100)
   */
  socket.on("submit_number", (value) => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player || player.isEliminated) return;

    // 3. Number Submission Validation
    if (
      value === null ||
      value === undefined ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 100
    ) {
      return socket.emit('error', { message: 'Invalid number submitted' });
    }

    const round = room.currentRound;

    // 4. Game State Validation
    // - Check if game is in progress
    if (!room.isLocked) {
      return socket.emit('error', { message: 'Game has not started yet' });
    }
    // - Check if round is active (timer running)
    if (room.timerValue <= 0) {
      return socket.emit('error', { message: 'Round has already ended' });
    }
    // - Check for already submitted
    if (room.submissions[round] && room.submissions[round][socket.id] !== undefined) {
      // Ignore if already submitted
      return; 
    }

    if (!room.submissions[round]) room.submissions[round] = {};

    room.submissions[round][socket.id] = parseFloat(value);

    // Calculate submission progress
    const activePlayers = Object.values(room.players).filter(
      (p) => !p.isEliminated && p.isActive,
    );
    const submissionCount = Object.keys(room.submissions[round]).length;

    // Inform clients of progress
    io.to(room.code).emit("submission_update", {
      count: submissionCount,
      total: activePlayers.length,
    });

    // Automatically trigger calculation if everyone has submitted
    if (submissionCount >= activePlayers.length) {
      if (room.timer) clearInterval(room.timer);
      calculateResults(room.code);
    }
  });

  /**
   * Event: disconnect
   * Handles player disconnection. If game is in progress, the player is eliminated.
   */
  socket.on("disconnect", () => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    if (player) {
      player.isActive = false;
      // Requirement: Instant elimination if disconnected during active game
      if (room.isLocked) {
        player.isEliminated = true;
      }
      broadcastRoomUpdate(room.code);
    }
  });
});

/**
 * Sends the current room/player state to all participants in a room.
 * @param {string} code - Room code
 */
function broadcastRoomUpdate(code) {
  const room = rooms[code];
  if (!room) return;
  const activePlayers = Object.values(room.players).filter(
    (p) => !p.isEliminated,
  );
  io.to(code).emit("room_update", {
    activeCount: activePlayers.length,
    players: Object.values(room.players).map((p) => ({
      name: p.name,
      score: p.score,
      isHost: p.isHost,
      isEliminated: p.isEliminated,
      eliminatedInRound: p.eliminatedInRound,
      isActive: p.isActive,
    })),
  });
}

/**
 * Initializes a new round and starts the countdown timer.
 * @param {string} code - Room code
 */
function startNewRound(code) {
  const room = rooms[code];
  if (!room) return;

  room.currentRound++;
  room.timerValue = 60; // 60 seconds submission window

  if (room.timer) clearInterval(room.timer);

  io.to(code).emit("round_start", {
    round: room.currentRound,
    timer: room.timerValue,
  });

  // Start the ticking timer
  room.timer = setInterval(() => {
    room.timerValue--;
    io.to(code).emit("timer_tick", { timer: room.timerValue });

    if (room.timerValue <= 0) {
      clearInterval(room.timer);
      calculateResults(code); // Times up! Calculate results
    }
  }, 1000);
}

/**
 * Core Game Logic:
 * Calculates average, target (Average * 0.8), and assigns penalties.
 * Handles special Alice in Borderland rules (Duplicate, Exact Hits, Duel).
 * @param {string} code - Room code
 */
function calculateResults(code) {
  const room = rooms[code];
  if (!room) return;

  if (room.timer) clearInterval(room.timer);

  const round = room.currentRound;
  const players = Object.values(room.players).filter((p) => !p.isEliminated);
  const roundSubmissions = room.submissions[round] || {};

  // Auto-fill missing submissions with random numbers
  players.forEach((p) => {
    if (roundSubmissions[p.id] === undefined) {
      roundSubmissions[p.id] = Math.floor(Math.random() * 100) + 1;
      if (!room.autoSubmitters) room.autoSubmitters = {};
      if (!room.autoSubmitters[round]) room.autoSubmitters[round] = [];
      room.autoSubmitters[round].push(p.id);
    }
  });

  // Rule 1: Calculate Target (Average of all numbers * 0.8)
  const values = Object.values(roundSubmissions);
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const target = avg * 0.8;

  const eliminatedCount = Object.values(room.players).filter(
    (p) => p.isEliminated,
  ).length;

  // Rule 2: Duplicate Penalty (If 1+ players are already eliminated)
  // If multiple players pick the same number, they are disqualified from winning.
  let disqualifiedIds = [];
  if (eliminatedCount >= 1) {
    const counts = {};
    values.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
    players.forEach((p) => {
      if (counts[roundSubmissions[p.id]] > 1) disqualifiedIds.push(p.id);
    });
  }

  let winners = [];
  let closestDiff = 101;

  // Rule 3: Special Duel Rule (When only 2 players remain)
  // If one picks 0 and the other picks 100, the one who picked 100 wins.
  let specialWinnerId = null;
  if (players.length === 2) {
    const p1 = players[0];
    const p2 = players[1];
    const v1 = roundSubmissions[p1.id];
    const v2 = roundSubmissions[p2.id];
    if ((v1 === 0 && v2 === 100) || (v1 === 100 && v2 === 0)) {
      specialWinnerId = v1 === 100 ? p1.id : p2.id;
    }
  }

  // Find the winner(s) - closest to target number
  if (specialWinnerId) {
    winners = [specialWinnerId];
  } else {
    players.forEach((p) => {
      if (disqualifiedIds.includes(p.id)) return;
      const diff = Math.abs(roundSubmissions[p.id] - target);
      if (diff < closestDiff) {
        closestDiff = diff;
        winners = [p.id];
      } else if (diff === closestDiff) {
        winners.push(p.id);
      }
    });
  }

  // Rule 4: Exact Hit Penalty (If 2+ players are already eliminated)
  // If someone hits the target exactly, all other players lose 2 points instead of 1.
  const isExactHit = winners.some(
    (id) => roundSubmissions[id] === parseFloat(target),
  );
  const exactHitRuleActive = eliminatedCount >= 2 && isExactHit;
  const normalPenalty = exactHitRuleActive ? -2 : -1;

  // Apply scores and check for elimination (-10 points means death/elimination)
  const roundData = players.map((p) => {
    let change = 0;
    let isDisqualified = disqualifiedIds.includes(p.id);
    let isWinner = winners.includes(p.id);

    if (isDisqualified) {
      change = -2; // Duplicate penalty is always a flat -2
    } else if (!isWinner) {
      change = normalPenalty;
    }

    p.score += change;
    if (p.score <= -10 && !p.isEliminated) {
      p.isEliminated = true;
      p.eliminatedInRound = round;
    }

    return {
      name: p.name,
      value: roundSubmissions[p.id],
      change,
      score: p.score,
      isWinner: isWinner,
      isEliminated: p.isEliminated,
      disqualified: isDisqualified,
      isAutoSubmitted: room.autoSubmitters?.[round]?.includes(p.id),
      penaltyDescription: isDisqualified
        ? "Duplicate Penalty"
        : change === -2
          ? "Exact Hit Penalty"
          : null,
    };
  });

  // Check Game Over Condition
  const activeRemaining = Object.values(room.players).filter(
    (p) => !p.isEliminated,
  );
  const gameOver = activeRemaining.length <= 1;
  const winnerName = gameOver ? activeRemaining[0]?.name || "Nobody" : null;

  // Emit results to all players
  io.to(code).emit("round_results", {
    results: {
      average: avg.toFixed(2),
      target: target.toFixed(2),
      players: roundData,
      game_over: gameOver,
      winner: winnerName,
      exactHit: exactHitRuleActive,
      exactWinner: exactHitRuleActive
        ? players.find((p) => winners.includes(p.id))?.name
        : null,
    },
    round,
  });

  if (gameOver) {
    // End game after a short delay
    setTimeout(() => {
      io.to(code).emit("game_over", { winner: winnerName });
    }, 5000);
  } else {
    // Rule: Brief cooldown period between rounds
    room.timerValue = 10;
    room.timer = setInterval(() => {
      room.timerValue--;
      io.to(code).emit("cooldown_tick", { timer: room.timerValue });

      if (room.timerValue <= 0) {
        clearInterval(room.timer);
        startNewRound(code); // Proceed to next round automatically
      }
    }, 1000);
  }
}

/**
 * Express Health Check and Server Start
 */
const PORT = process.env.PORT || 8000;
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

