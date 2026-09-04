import dotenv from 'dotenv';

dotenv.config();

const GROQ_URL = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Stats cumulables par compétition supports par le moteur de score (cumul carrière)
const STAT_OPTIONS = [
  { field: 'goals', statistic: 'Buts' },
  { field: 'assists', statistic: 'Passes décisives' },
  { field: 'goals+assists', statistic: 'Contributions offensives' },
  { field: 'appearances', statistic: 'Matchs joués' },
  { field: 'yellowCards', statistic: 'Cartons jaunes', cumulative: false },
  { field: 'redCards', statistic: 'Cartons rouges', cumulative: false },
];

// Compétitions avec assez de joueurs connus pour l'échantillonnage
const COMPETITIONS = [
  'Premier League', 'La Liga', 'Serie A', 'Ligue 1', 'Bundesliga',
  'Champions League', 'Europa League',
  'Équipe nationale',
];

// Phrasings de challenge pour varier l'expérience
const CHALLENGE_FRAMING = [
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

/**
 * Appelle Groq pour obtenir une cible logique étant donné une plage réaliste.
 * Retourne un entier, ou null si l'appel/le parsing échoue.
 */
async function askTarget(field, statistic, competition, range) {
  if (!GROQ_API_KEY) return null;

  const examples = range.values
    .map((v) => `${v}`)
    .slice(0, 6)
    .join(', ');

  const prompt = `
Tu es le générateur de défis d'un jeu de pronostics foot nommé "gamarha".
Le score des joueurs est leur cumul CARRIÈRE de la statistique dans une compétition donnée.

On veut un défi : "${statistic} en ${competition}", pour une équipe de 3 joueurs.
Les cumuls carrière réels de vrais joueurs de ${competition} pour "${statistic}" vont de ${range.min} à ${range.max} (exemples observés : ${examples}).

Réponds UNIQUEMENT en JSON valide :
{ "target": <entier> }

Choisis "target" :
- entier POSITIF/non-négatif, LOGIQUE pour une somme de 3 joueurs de ${competition} en ${statistic}.
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
 * Génère un défi complet : on choisit la stat + la compétition côté serveur,
 * on échantillonne la plage réelle depuis FotMob, puis on demande une cible à Groq.
 */
export async function generateChallenge() {
  const opt = STAT_OPTIONS[Math.floor(Math.random() * STAT_OPTIONS.length)];
  const competition = COMPETITIONS[Math.floor(Math.random() * COMPETITIONS.length)];

  const { estimateCareerRange } = await import('./fotmob.js');
  let range = null;
  try {
    range = await estimateCareerRange(competition, opt.field);
  } catch {
    range = null;
  }

  let target = range && Math.floor((range.min + range.max) / 2);
  if (range) {
    // Demande une cible intelligente à Groq en lui montrant la plage réelle
    const ai = await askTarget(opt.field, opt.statistic, competition, range);
    if (ai !== null) target = ai;
    else {
      // Fallback : cible aléatoire réaliste dans la plage étendue
      target = Math.floor(Math.random() * (range.max * 2 - range.min)) + range.min;
    }
  } else if (target === null || target === 0) {
    target = Math.floor(Math.random() * 401) + 50;
  }

  const framingFn = CHALLENGE_FRAMING[Math.floor(Math.random() * CHALLENGE_FRAMING.length)];
  const framing = framingFn(opt.statistic, competition);

  return {
    target,
    statistic: opt.statistic,
    field: opt.field,
    competition,
    framing,
  };
}