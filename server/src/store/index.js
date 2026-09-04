import { v4 as uuidv4 } from 'uuid';
import { generateChallenge } from '../services/challenge.js';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_SECONDS = Number.parseInt(process.env.CHALLENGE_CACHE_SECONDS || '3600', 10);

// Map des salles : roomCode -> room object
const rooms = new Map();

// Cache de défis générés par l'IA (bits par jour)
const challengeCache = new Map();
let lastCacheReset = Date.now();

// Stats classées (matchmaking) : userId -> { wins, losses, elo }
const leaderboard = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(host) {
  const code = generateRoomCode();
  const room = {
    code,
    id: uuidv4(),
    hostId: host.id,
    players: [{ ...host, socketId: host.socketId }],
    status: 'lobby', // lobby | betting | revealed | finished
    challenge: null,
    target: null,
    statistic: null,
    competition: null,
    field: null,
    bets: new Map(), // playerId -> [playerIds]
    winners: [],
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  const normalized = (code || '').toUpperCase().trim();
  return rooms.get(normalized);
}

function joinRoom(code, player) {
  const room = getRoom(code);
  if (!room) return null;
  if (room.status !== 'lobby' && room.status !== 'betting') return null;

  const existing = room.players.find((p) => p.id === player.id);
  if (existing) {
    existing.socketId = player.socketId;
    return room;
  }

  room.players.push({ ...player, socketId: player.socketId });
  return room;
}

function leaveRoom(code, playerId) {
  const room = getRoom(code);
  if (!room) return null;
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx !== -1) room.players.splice(idx, 1);
  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
  return room;
}

function placeBet(code, playerId, playerIds, players) {
  const room = getRoom(code);
  if (!room) return { error: 'Salle introuvable' };
  if (room.status !== 'betting') return { error: 'La phase de paris est terminée (délai écoulé ou résultats révélés)' };
  if (room.players.some((p) => p.id === playerId) === false) return { error: 'Tu ne fais plus partie de la salle (recharge la page)' };
  if (playerIds.length !== 3) return { error: 'Sélectionne exactement 3 joueurs' };

  room.bets.set(playerId, {
    ids: playerIds,
    chosen: (players || []).map((p) => ({
      id: Number(p.id),
      name: p.name || null,
      team: p.team || null,
      photo: p.photo || null,
    })),
  });
  return room;
}

/**
 * Récupère un défi, depuis le cache ou via Ollama
 */
async function getOrCreateChallenge() {
  // Reset quotidien du cache pour varier les défis
  const now = Date.now();
  if (now - lastCacheReset > 24 * 60 * 60 * 1000) {
    challengeCache.clear();
    lastCacheReset = now;
  }

  const todayKey = new Date(now).toISOString().slice(0, 10);
  const cacheKey = todayKey;

  if (challengeCache.has(cacheKey)) {
    const entry = challengeCache.get(cacheKey);
    if (Date.now() - entry.time < CACHE_SECONDS * 1000) {
      return entry.challenge;
    }
  }

  let challenge;
  try {
    challenge = await generateChallenge();
  } catch (e) {
    console.warn('[gamarha] Groq unreachable, fallback to hardcoded challenge:', e.message);
    challenge = fallbackChallenge();
  }

  challengeCache.set(cacheKey, { challenge, time: now });

  return challenge;
}

/**
 * Génère un NOUVEAU défi à chaque appel (défi propre à chaque partie),
 * avec fallback si Groq est injoignable. Pas de cache partagé.
 */
async function getFreshChallenge() {
  try {
    return await generateChallenge();
  } catch (e) {
    console.warn('[gamarha] Groq unreachable, fallback to hardcoded challenge:', e.message);
    return fallbackChallenge();
  }
}

function fallbackChallenge() {
  const options = [
    { target: 137, statistic: 'Buts', field: 'goals', competition: 'Premier League', framing: 'Le meilleur total de Buts en Premier League ?' },
    { target: 245, statistic: 'Matchs joués', field: 'appearances', competition: 'Premier League', framing: 'Qui cumule le plus de Matchs joués en Premier League ?' },
    { target: 89, statistic: 'Passes décisives', field: 'assists', competition: 'La Liga', framing: 'Ensemble, on bat le record : Passes décisives en La Liga.' },
    { target: 310, statistic: 'Contributions offensives', field: 'goals+assists', competition: 'Serie A', framing: 'Le défi : rassembler le maximum de Contributions offensives en Serie A.' },
    { target: 45, statistic: 'Cartons jaunes', field: 'yellowCards', competition: 'Bundesliga', framing: 'La fiabilité : le moins de Cartons jaunes en Bundesliga.' },
    { target: 180, statistic: 'Buts', field: 'goals', team: 'Real Madrid CF', framing: 'Le meilleur total de Buts pour Real Madrid CF ?' },
    { target: 200, statistic: 'Matchs joués', field: 'appearances', team: 'Juventus', framing: 'Qui a le plus de Matchs joués avec Juventus ?' },
    { target: 120, statistic: 'Contributions offensives', field: 'goals+assists', team: 'FC Barcelona', framing: 'Les légendes de FC Barcelona : Contributions offensives cumulées.' },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function startBetting(code) {
  const room = getRoom(code);
  if (!room) return null;
  room.bets = new Map();
  room.status = 'betting';
  room.winners = [];
  room.results = null;
  // Annule la suppression auto de la salle si on relance une manche
  if (room.deleteTimer) {
    clearTimeout(room.deleteTimer);
    room.deleteTimer = null;
  }
  return room;
}

// --- Score / classement ---

function recordResult(userId, name, winner) {
  const entry = leaderboard.get(userId) || { userId, name, wins: 0, losses: 0, elo: 1200 };
  if (name) entry.name = name;
  if (winner) {
    entry.wins += 1;
    entry.elo = Math.max(100, entry.elo + 20);
  } else {
    entry.losses += 1;
    entry.elo = Math.max(100, entry.elo - 10);
  }
  leaderboard.set(userId, entry);
  return entry;
}

function getLeaderboard() {
  return [...leaderboard.values()].sort((a, b) => b.elo - a.elo);
}

export default {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  placeBet,
  startBetting,
  getOrCreateChallenge,
  getFreshChallenge,
  recordResult,
  getLeaderboard,
  rooms,
};