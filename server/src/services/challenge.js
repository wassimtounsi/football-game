import dotenv from 'dotenv';

dotenv.config();

const GROQ_URL = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Stats cumulables par compétition / équipe supports par le moteur de score (cumul carrière)
const STAT_OPTIONS = [
  { field: 'goals', statistic: 'Buts' },
  { field: 'assists', statistic: 'Passes décisives' },
  { field: 'goals+assists', statistic: 'Contributions offensives' },
  { field: 'appearances', statistic: 'Matchs joués' },
  { field: 'yellowCards', statistic: 'Cartons jaunes', cumulative: false },
  { field: 'redCards', statistic: 'Cartons rouges', cumulative: false },
];

// Compétitions (ligues / tournois)
const COMPETITIONS = [
  'Premier League', 'La Liga', 'Serie A', 'Ligue 1', 'Bundesliga',
  'Champions League', 'Europa League',
  'Équipe nationale',
];

// Phrasings pour les défis par COMPÉTITION
const FRAMING_LEAGUE = [
  (stat, comp) => `Le meilleur total de ${stat} en ${comp} ?`,
  (stat, comp) => `Qui cumule le plus de ${stat} en ${comp} ?`,
  (stat, comp) => `Ensemble, on bat le record : ${stat} en ${comp}.`,
  (stat, comp) => `Ton trio de légendes : ${stat} en ${comp}.`,
  (stat, comp) => `L'objectif : ${stat} cumulés en ${comp}.`,
  (stat, comp) => `Le défi : rassembler le maximum de ${stat} en ${comp}.`,
  (stat, comp) => `Combo gagnant : ${stat} en ${comp}.`,
  (stat, comp) => `Ta dream team ${comp} : ${stat}.`,
  (stat, comp) => `${stat} en ${comp} — à toi de jouer.`,
  (stat, comp) => `Les stats mentent pas : ${stat} en ${comp}.`,
  (stat, comp) => `Quel total de ${stat} en ${comp} peux-tu atteindre ?`,
  (stat, comp) => `3 joueurs, ${comp} : maximise les ${stat}.`,
];

// Phrasings pour les défis par ÉQUIPE
const FRAMING_TEAM = [
  (stat, team) => `Le meilleur total de ${stat} pour ${team} ?`,
  (stat, team) => `Qui a marqué le plus de ${stat} avec ${team} ?`,
  (stat, team) => `Les légendes de ${team} : ${stat} cumulés.`,
  (stat, team) => `3 anciens/${team} : maximise les ${stat}.`,
  (stat, team) => `Le défi ${team} : rassembler le maximum de ${stat}.`,
  (stat, team) => `Ta dream team ${team} : ${stat}.`,
  (stat, team) => `${stat} portant le maillot de ${team} — à toi de jouer.`,
  (stat, team) => `Les stats ${team} mentent pas : ${stat}.`,
  (stat, team) => `Quel total de ${stat} avec ${team} peux-tu atteindre ?`,
  (stat, team) => `L'histoire de ${team} en ${stat}.`,
];

/**
 * Appelle Groq pour obtenir une cible logique étant donné une plage réaliste.
 * Retourne un entier, ou null si l'appel/le parsing échoue.
 */
async function askTarget(field, statistic, contextLabel, range) {
  if (!GROQ_API_KEY) return null;

  const examples = range.values
    .map((v) => `${v}`)
    .slice(0, 6)
    .join(', ');

  const prompt = `
Tu es le générateur de défis d'un jeu de pronostics foot nommé "gamarha".
Le score des joueurs est leur cumul CARRIÈRE de la statistique dans un contexte donné.

On veut un défi : "${statistic} pour ${contextLabel}", pour une équipe de 3 joueurs.
Les cumuls carrière réels de vrais joueurs de ${contextLabel} pour "${statistic}" vont de ${range.min} à ${range.max} (exemples observés : ${examples}).

Réponds UNIQUEMENT en JSON valide :
{ "target": <entier> }

Choisis "target" :
- entier POSITIF/non-négatif, LOGIQUE pour une somme de 3 joueurs de ${contextLabel} en ${statistic}.
- DANS la fourchette réaliste environ [${range.min}, ${range.max}] (une somme de 3 bons joueurs se situe généralement au-delà du max d'un seul joueur, mais reste crédible).
- assez difficile pour qu'une équipe de 3 joueurs ne l'atteigne qu'avec de bons choix, mais pas impossible.
- Pas de texte autour du JSON.
`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1.1,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    const target = Number.parseInt(parsed?.target, 10);
    if (Number.isNaN(target) || target < 0) return null;
    return target;
  } catch {
    return null;
  }
}

/**
 * Génère un défi complet : aléatoirement compétition OU équipe,
 * on échantillonne la plage réelle depuis FotMob, puis on demande une cible à Groq.
 */
export async function generateChallenge() {
  const opt = STAT_OPTIONS[Math.floor(Math.random() * STAT_OPTIONS.length)];
  const isTeamChallenge = Math.random() < 0.5;

  const { estimateCareerRange, estimateCareerRangeForTeam, TOP_TEAMS } = await import('./fotmob.js');

  let contextLabel = '';
  let range = null;
  let competition = null;
  let team = null;

  if (isTeamChallenge) {
    // Défi par équipe
    team = TOP_TEAMS[Math.floor(Math.random() * TOP_TEAMS.length)];
    contextLabel = team;
    try {
      range = await estimateCareerRangeForTeam(team, opt.field);
    } catch {
      range = null;
    }
  } else {
    // Défi par compétition (comportement existant)
    competition = COMPETITIONS[Math.floor(Math.random() * COMPETITIONS.length)];
    contextLabel = competition;
    try {
      range = await estimateCareerRange(competition, opt.field);
    } catch {
      range = null;
    }
  }

  let target = range && Math.floor((range.min + range.max) / 2);
  if (range) {
    const ai = await askTarget(opt.field, opt.statistic, contextLabel, range);
    if (ai !== null) target = ai;
    else {
      target = Math.floor(Math.random() * (range.max * 2 - range.min)) + range.min;
    }
  } else if (target === null || target === 0) {
    target = Math.floor(Math.random() * 401) + 50;
  }

  const framingPool = isTeamChallenge ? FRAMING_TEAM : FRAMING_LEAGUE;
  const framingFn = framingPool[Math.floor(Math.random() * framingPool.length)];
  const framing = framingFn(opt.statistic, contextLabel);

  return {
    target,
    statistic: opt.statistic,
    field: opt.field,
    competition,
    team,
    framing,
  };
}
