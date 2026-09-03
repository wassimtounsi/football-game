import store from '../store/index.js';
import fotmob, { getPlayerStats, extractStats } from '../services/fotmob.js';

let _io = null;

// File d'attente du matchmaking classé : [{ socketId, playerId, name }]
const mmQueue = [];

export function setupSocket(io) {
  _io = io;

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.id} connected`);

    socket.on('room:create', async (data, ack) => {
      const { playerId, name } = data || {};
      if (!playerId || !name) {
        return ack?.({ error: 'playerId et name requis' });
      }

      const room = store.createRoom({ id: playerId, name, socketId: socket.id });
      socket.join(room.code);
      socket.data.playerId = playerId;
      socket.data.name = name;
      ack?.({ ok: true, code: room.code });

      const challenge = await store.getOrCreateChallenge();
      io.to(room.code).emit('challenge', challenge);
    });

    socket.on('room:join', (data, ack) => {
      const { code, playerId, name } = data || {};
      const room = store.joinRoom(code, { id: playerId, name, socketId: socket.id });
      if (!room) {
        return ack?.({ error: 'Salle introuvable ou fermée' });
      }
      socket.join(room.code);
      socket.data.playerId = playerId;
      socket.data.name = name;
      ack?.({ ok: true, room: publicRoom(room) });
      io.to(room.code).emit('players:update', publicRoom(room).players);

      if (room.challenge) {
        socket.emit('challenge', room.challenge);
      }
      if (room.status === 'betting') {
        socket.emit('phase', { status: 'betting', deadline: room.deadline });
      }
    });

    socket.on('room:start', async (data, ack) => {
      const { code } = data || {};
      const room = store.getRoom(code);
      if (!room) return ack?.({ error: 'Salle introuvable' });
      if (room.hostId !== socket.data?.playerId) {
        return ack?.({ error: 'Seul l\'hôte peut starter' });
      }

      const room2 = store.startBetting(code);
      if (!room2) return ack?.({ error: 'Impossible de démarrer' });

      const challenge = await store.getFreshChallenge();
      room2.challenge = challenge;
      room2.target = challenge.target;
      room2.statistic = challenge.statistic;
      room2.competition = challenge.competition;
      room2.field = challenge.field;
      room2.deadline = Date.now() + 90_000; // 90 secondes pour parier

      io.to(code).emit('challenge', challenge);
      io.to(code).emit('phase', { status: 'betting', deadline: room2.deadline });
      ack?.({ ok: true });

      // Révélation automatique après le délai (reset si on relance une manche)
      if (room2.revealTimer) clearTimeout(room2.revealTimer);
      room2.revealTimer = setTimeout(() => revealRoom(code), 90_000);
    });

    socket.on('bet:place', (data, ack) => {
      const { code, playerId, players = [] } = data || {};
      const playerIds = (data?.playerIds || []).length === 3 ? data.playerIds.map((x) => Number(x)) : players.map((p) => p.id);
      const room = store.placeBet(code, playerId, playerIds, players);
      if (!room) return ack?.({ error: 'Pari invalide ou salle fermée' });

      const nbBets = [...room.bets.keys()].length;
      const expected = room.players.length;
      ack?.({ ok: true });
      io.to(code).emit('bet:progress', { placed: nbBets, total: expected });

      if (nbBets >= expected) {
        revealRoom(code);
      }
    });

    socket.on('room:leave', (data, ack) => {
      const { code, playerId } = data || {};
      const room = store.leaveRoom(code, playerId);
      if (room) {
        io.to(code).emit('players:update', publicRoom(room).players);
        if (room.status === 'betting') {
          const nbBets = [...room.bets.keys()].length;
          const expected = room.players.length;
          if (nbBets >= expected && expected > 0) revealRoom(code);
        }
      }
      ack?.({ ok: true });
    });

    socket.on('room:sync', (data, ack) => {
      const { code, playerId } = data || {};
      const room = store.getRoom(code);
      if (!room) return ack?.({ error: 'Salle introuvable' });

      socket.join(code);
      socket.data.playerId = playerId;

      if (room.players.some((p) => p.id === playerId) === false) {
        // Le joueur n'était pas enregistré (refresh) -> on le réenregistre
        room.players.push({ id: playerId, name: socket.data?.name || 'Joueur', socketId: socket.id });
      }

      ack?.({
        room: publicRoom(room),
        challenge: room.challenge,
        phase: { status: room.status, deadline: room.deadline },
        revealed: room.results || null,
        betProgress: room.bets
          ? { placed: room.bets.size, total: room.players.length }
          : null,
      });

      io.to(code).emit('players:update', publicRoom(room).players);
    });

    socket.on('matchmaking:join', async (data, { ack } = {}) => {
      const playerId = data?.playerId || socket.data.playerId;
      const name = data?.name || socket.data.name || 'Joueur';

      const already = store.getLeaderboard().find((e) => e.userId === playerId);
      socket.emit('matchmaking:queue', { status: 'searching', elo: already?.elo || 1200 });

      mmQueue.push({ socketId: socket.id, playerId, name });
      socket.data.inMatchmaking = true;

      // Pair deux joueurs en file
      if (mmQueue.length >= 2) {
        const a = mmQueue.shift();
        const b = mmQueue.shift();

        const room = store.createRoom({ id: a.playerId, name: a.name, socketId: a.socketId });
        store.joinRoom(room.code, { id: b.playerId, name: b.name, socketId: b.socketId });

        const sa = io.sockets.sockets.get(a.socketId);
        const sb = io.sockets.sockets.get(b.socketId);
        if (sa) { sa.join(room.code); sa.data.playerId = a.playerId; sa.data.inMatchmaking = false; }
        if (sb) { sb.join(room.code); sb.data.playerId = b.playerId; sb.data.inMatchmaking = false; }

        // Génère le défi puis lance directement la phase de pari
        const challenge = await store.getFreshChallenge();
        store.startBetting(room.code);
        room.challenge = challenge;
        room.target = challenge.target;
        room.statistic = challenge.statistic;
        room.competition = challenge.competition;
        room.field = challenge.field;
        room.deadline = Date.now() + 90_000;

        io.to(room.code).emit('matchmaking:found', { code: room.code });
        io.to(room.code).emit('challenge', challenge);
        io.to(room.code).emit('phase', { status: 'betting', deadline: room.deadline });
        io.to(room.code).emit('players:update', publicRoom(room).players);

        setTimeout(() => revealRoom(room.code), 90_000);
      }
    });

    socket.on('matchmaking:leave', () => {
      const idx = mmQueue.findIndex((q) => q.socketId === socket.id);
      if (idx !== -1) mmQueue.splice(idx, 1);
      socket.data.inMatchmaking = false;
      socket.emit('matchmaking:queue', { status: 'idle' });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] ${socket.id} disconnected`);
      const mmIdx = mmQueue.findIndex((q) => q.socketId === socket.id);
      if (mmIdx !== -1) mmQueue.splice(mmIdx, 1);
      for (const [code, room] of store.rooms) {
        const player = room.players.find((p) => p.socketId === socket.id);
        if (player) {
          store.leaveRoom(code, player.id);
          io.to(code).emit('players:update', publicRoom(room));
        }
      }
    });
  });
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  };
}

function statValue(stats, field) {
  switch (field) {
    case 'goals': return stats.goals ?? 0;
    case 'assists': return stats.assists ?? 0;
    case 'appearances': return stats.appearances ?? 0;
    case 'minutesPlayed': return stats.minutesPlayed ?? 0;
    case 'yellowCards': return stats.yellowCards ?? 0;
    case 'started': return stats.started ?? stats.appearances ?? 0;
    default: return stats.goals ?? 0;
  }
}

/**
 * Champs qui peuvent être cumulés sur toute la carrière, filtrés par compétition.
 * Les autres (minutes, cartons) ne sont disponibles que pour la saison en cours.
 */
const CUMULATIVE_FIELDS = new Set(['goals', 'assists', 'appearances']);

/**
 * Calcule la valeur d'un joueur pour un champ donné :
 * - si le champ est cumulable -> somme sur toute la carrière dans la compétition du défi
 * - sinon -> valeur de la saison en cours (fallback)
 */
function computeScore(rawPlayer, field, competition) {
  if (CUMULATIVE_FIELDS.has(field)) {
    const stats = extractStats(rawPlayer);
    return fotmob.careerStatInCompetition(rawPlayer, competition, field);
  }
  return statValue(extractStats(rawPlayer), field);
}

function logBets(bets) {
  for (const [pid, bet] of bets) {
    const ids = Array.isArray(bet) ? bet : (bet?.ids || []);
    console.log(`  bet by ${pid}:`, ids.join(','));
  }
}

/**
 * Révèle les résultats : calcule la somme réelle pour chaque pari,
 * classe les joueurs par proximité à la cible, désigne le(s) vainqueur(s).
 */
async function revealRoom(code) {
  const room = store.getRoom(code);
  if (!room || room.status === 'revealed' || room.status === 'finished') return;
  if (room.status !== 'betting') return;

  room.status = 'revealed';
  console.log(`[gamarha] revealRoom started for ${code}, bets=${room.bets.size}`);
  await logBets(room.bets);

  const results = [];

  for (const [playerId, bet] of room.bets) {
    const player = room.players.find((p) => p.id === playerId);
    // bet est soit { ids, chosen } (nouveau) soit un tableau d'ids (ancien format)
    const ids = Array.isArray(bet) ? bet.map((x) => Number(x)) : (bet?.ids || []).map((x) => Number(x));
    const chosen = Array.isArray(bet) ? [] : bet?.chosen || [];

    const details = [];
    let total = 0;

    for (let i = 0; i < ids.length; i++) {
      const pid = ids[i];
      const pick = chosen.find((c) => Number(c.id) === Number(pid));
      try {
        const raw = await getPlayerStats(pid);
        const stats = extractStats(raw);
        const value = computeScore(raw, room.field, room.competition);
        total += value;
        details.push({
          id: pid,
          name: stats.name || pick?.name || 'Joueur',
          value,
          photo: stats.photo || pick?.photo || null,
        });
      } catch (err) {
        console.warn(`[gamarha] stat fetch failed for ${pid}:`, err.message);
        // On garde le vrai nom/tête du joueur choisi même si la stat détaillée échoue
        details.push({ id: pid, name: pick?.name || 'Joueur', value: 0, photo: pick?.photo || null, error: true });
      }
    }

    const diff = Math.abs(total - room.target);
    results.push({
      playerId,
      name: player?.name || 'Inconnu',
      details,
      total,
      diff,
    });
  }

  // Tri ascendant selon la proximité
  results.sort((a, b) => a.diff - b.diff);

  const minDiff = results[0]?.diff ?? 0;
  const winners = results.filter((r) => r.diff === minDiff).map((r) => r.playerId);

  room.winners = winners;
  room.results = results;
  room.status = 'finished';

  // Met à jour le classement
  for (const r of results) {
    store.recordResult(r.playerId, r.name, winners.includes(r.playerId));
  }

  const io = _io;
  const cumulative = CUMULATIVE_FIELDS.has(room.field);
  io.to(code).emit('reveal', {
    target: room.target,
    statistic: room.statistic,
    competition: room.competition,
    cumulative,
    results,
    winners,
    leaderboard: store.getLeaderboard().slice(0, 50),
  });

  // Auto-suppression de la salle après 2 minutes (annulé si on relance une manche)
  if (room.deleteTimer) clearTimeout(room.deleteTimer);
  room.deleteTimer = setTimeout(() => {
    store.rooms.delete(code);
  }, 120_000);
}

export default {
  setupSocket,
};