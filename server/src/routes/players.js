import { Router } from 'express';
import { searchPlayers, getPlayerStats } from '../services/fotmob.js';

const router = Router();

// GET /api/players/search?name=mbappe
router.get('/search', async (req, res) => {
  const { name } = req.query;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nom trop court (min 2 caractères)' });
  }
  try {
    const players = await searchPlayers(name);
    res.json({ players });
  } catch (e) {
    res.status(502).json({ error: 'Impossible de contacter l\'API football', detail: e.message });
  }
});

// GET /api/players/:id/stats
router.get('/:id/stats', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'id invalide' });
  }
  try {
    const data = await getPlayerStats(id);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Impossible de contacter l\'API football', detail: e.message });
  }
});

export default router;