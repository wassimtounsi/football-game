import { Router } from 'express';
import store from '../store/index.js';

const router = Router();

// POST /api/rooms/create
router.post('/create', (req, res) => {
  const { playerId, name } = req.body || {};
  if (!playerId || !name) {
    return res.status(400).json({ error: 'playerId et name requis' });
  }
  const room = store.createRoom({ id: playerId, name, socketId: '' });
  res.json({ code: room.code });
});

// GET /api/rooms/:code
router.get('/:code', (req, res) => {
  const room = store.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });
  res.json({
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    challenge: room.challenge,
    target: room.target,
    statistic: room.statistic,
    competition: room.competition,
    field: room.field,
  });
});

// GET /api/rooms/:code/results
router.get('/:code/results', async (req, res) => {
  const room = store.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: 'Salle introuvable' });
  if (room.status === 'betting') {
    return res.status(425).json({ error: 'Pari en cours, patientez' });
  }
  res.json({ winners: room.winners });
});

// GET /leaderboard
router.get('/leaderboard', (_req, res) => {
  res.json({ leaderboard: store.getLeaderboard() });
});

export default router;