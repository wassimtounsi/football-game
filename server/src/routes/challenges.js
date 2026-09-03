import { Router } from 'express';
import store from '../store/index.js';

const router = Router();

// GET /api/challenges/random - génère un nouveau défi (sans jouer)
router.get('/random', async (_req, res) => {
  try {
    const challenge = await store.getOrCreateChallenge();
    return res.json(challenge);
  } catch (e) {
    return res.status(500).json({ error: 'Erreur génération du défi', detail: e.message });
  }
});

export default router;