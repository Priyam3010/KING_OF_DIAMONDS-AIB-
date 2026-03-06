const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const corsOptions = {
  origin: [
    "https://king-of-diamonds-aib-2.onrender.com",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://king-of-diamonds-aib-2.onrender.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Game State
const rooms = {}; 

/**
 * Room Object Structure:
 * {
 *   code: string,
 *   isLocked: boolean,
 *   currentRound: number,
 *   players: { [socketId: string]: Player },
 *   submissions: { [roundNumber: number]: { [socketId: string]: number } }
 * }
 * 
 * Player Object Structure:
 * {
 *   id: string (socketId),
 *   name: string,
 *   score: number,
 *   isHost: boolean,
 *   isEliminated: boolean,
 *   isActive: boolean
 * }
 */

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', ({ code, name }) => {
        let room = rooms[code];
        
        if (!room) {
            room = {
                code,
                isLocked: false,
                currentRound: 0,
                players: {},
                submissions: {}
            };
            rooms[code] = room;
        }

        if (room.isLocked) {
            return socket.emit('error_msg', 'Game already in progress. This room is closed.');
        }

        const activePlayersCount = Object.values(room.players).filter(p => !p.isEliminated).length;
        if (activePlayersCount >= 8) {
            return socket.emit('error_msg', 'Room is full. Maximum 8 players allowed.');
        }

        // Check if player name exists in room (for reconnection)
        let player = Object.values(room.players).find(p => p.name === name);
        if (player) {
            // Simple reconnect logic: update socket ID
            delete room.players[player.id];
            player.id = socket.id;
            player.isActive = true;
            room.players[socket.id] = player;
        } else {
            player = {
                id: socket.id,
                name,
                score: 0,
                isHost: Object.keys(room.players).length === 0,
                isEliminated: false,
                isActive: true
            };
            room.players[socket.id] = player;
        }

        socket.join(code);
        socket.roomCode = code;
        socket.playerName = name;

        broadcastRoomUpdate(code);
    });

    socket.on('start_game', () => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player || !player.isHost) return;

        const activePlayers = Object.values(room.players).filter(p => !p.isEliminated);
        if (activePlayers.length < 3) {
            return socket.emit('error_msg', 'Minimum 3 players required to start.');
        }

        room.isLocked = true;
        io.to(room.code).emit('game_started');
        startNewRound(room.code);
    });

    socket.on('submit_number', (value) => {
        const room = rooms[socket.roomCode];
        if (!room || room.isEliminated) return;
        
        const player = room.players[socket.id];
        if (!player || player.isEliminated) return;

        const round = room.currentRound;
        if (!room.submissions[round]) room.submissions[round] = {};
        
        room.submissions[round][socket.id] = parseFloat(value);

        // Check if all active players submitted
        const activePlayers = Object.values(room.players).filter(p => !p.isEliminated && p.isActive);
        const submissionCount = Object.keys(room.submissions[round]).length;

        // Broadcast submission count
        io.to(room.code).emit('submission_update', {
            count: submissionCount,
            total: activePlayers.length
        });

        if (submissionCount >= activePlayers.length) {
            if (room.timer) clearInterval(room.timer);
            calculateResults(room.code);
        }
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomCode];
        if (!room) return;

        const player = room.players[socket.id];
        if (player) {
            player.isActive = false;
            // If game is in progress, eliminate immediately as per requirements
            if (room.isLocked) {
                player.isEliminated = true;
            }
            broadcastRoomUpdate(room.code);
        }
    });
});

function broadcastRoomUpdate(code) {
    const room = rooms[code];
    if (!room) return;
    const activePlayers = Object.values(room.players).filter(p => !p.isEliminated);
    io.to(code).emit('room_update', {
        activeCount: activePlayers.length,
        players: Object.values(room.players).map(p => ({
            name: p.name,
            score: p.score,
            isHost: p.isHost,
            isEliminated: p.isEliminated,
            eliminatedInRound: p.eliminatedInRound,
            isActive: p.isActive
        }))
    });
}

function startNewRound(code) {
    const room = rooms[code];
    if (!room) return;

    room.currentRound++;
    room.timerValue = 60; // Increased to 60 seconds
    
    // Clear any existing timer
    if (room.timer) clearInterval(room.timer);

    io.to(code).emit('round_start', {
        round: room.currentRound,
        timer: room.timerValue
    });

    room.timer = setInterval(() => {
        room.timerValue--;
        io.to(code).emit('timer_tick', { timer: room.timerValue });

        if (room.timerValue <= 0) {
            clearInterval(room.timer);
            calculateResults(code);
        }
    }, 1000);
}

function calculateResults(code) {
    const room = rooms[code];
    if (!room) return;

    if (room.timer) clearInterval(room.timer);

    const round = room.currentRound;
    const players = Object.values(room.players).filter(p => !p.isEliminated);
    const roundSubmissions = room.submissions[round] || {};

    // Auto-pick random for missing submissions
    players.forEach(p => {
        if (roundSubmissions[p.id] === undefined) {
            roundSubmissions[p.id] = Math.floor(Math.random() * 100) + 1; // 1-100
            if (!room.autoSubmitters) room.autoSubmitters = {};
            if (!room.autoSubmitters[round]) room.autoSubmitters[round] = [];
            room.autoSubmitters[round].push(p.id);
        }
    });

    const values = Object.values(roundSubmissions);
    const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    const target = avg * 0.8;

    const eliminatedCount = Object.values(room.players).filter(p => p.isEliminated).length;
    
    let disqualifiedIds = [];
    if (eliminatedCount >= 1) {
        const counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        players.forEach(p => {
            if (counts[roundSubmissions[p.id]] > 1) disqualifiedIds.push(p.id);
        });
    }

    let winners = [];
    let closestDiff = 101;

    // Special Duel Rule
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

    if (specialWinnerId) {
        winners = [specialWinnerId];
    } else {
        players.forEach(p => {
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

    const isExactHit = winners.some(id => roundSubmissions[id] === parseFloat(target));
    const exactHitRuleActive = eliminatedCount >= 2 && isExactHit;
    const normalPenalty = exactHitRuleActive ? -2 : -1;

    const roundData = players.map(p => {
        let change = 0;
        let isDisqualified = disqualifiedIds.includes(p.id);
        let isWinner = winners.includes(p.id);

        if (isDisqualified) {
            change = -2; // Duplicate penalty is always -2
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
            penaltyDescription: isDisqualified ? "Duplicate Penalty" : (change === -2 ? "Exact Hit Penalty" : null)
        };
    });

    const activeRemaining = Object.values(room.players).filter(p => !p.isEliminated);
    const gameOver = activeRemaining.length <= 1;
    const winnerName = gameOver ? (activeRemaining[0]?.name || 'Nobody') : null;

    io.to(code).emit('round_results', {
        results: {
            average: avg.toFixed(2),
            target: target.toFixed(2),
            players: roundData,
            game_over: gameOver,
            winner: winnerName,
            exactHit: exactHitRuleActive,
            exactWinner: exactHitRuleActive ? players.find(p => winners.includes(p.id))?.name : null
        },
        round
    });

    if (gameOver) {
        setTimeout(() => {
            io.to(code).emit('game_over', { winner: winnerName });
        }, 5000);
    } else {
        // Start Between-Round Timer
        room.timerValue = 10; // 10 seconds between rounds
        room.timer = setInterval(() => {
            room.timerValue--;
            io.to(code).emit('cooldown_tick', { timer: room.timerValue });

            if (room.timerValue <= 0) {
                clearInterval(room.timer);
                startNewRound(code);
            }
        }, 1000);
    }
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
