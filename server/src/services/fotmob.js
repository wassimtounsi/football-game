import dotenv from 'dotenv';

dotenv.config();

// URL racine (sans /api) : les endpoints _next/data et la photo sont à la racine du site
const BASE_URL = (process.env.FOTMOB_BASE_URL || 'https://www.fotmob.com').replace(/\/api$/, '');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Cache du buildId Next.js de FotMob (change à chaque déploiement)
let buildIdCache = { id: null, time: 0 };
const BUILD_ID_TTL = 30 * 60 * 1000; // 30 min : assez court pour éviter un buildId périmé

/**
 * Récupère le buildId Next.js actuel de FotMob (nécessaire pour l'API _next/data)
 * force=true ignore le cache (utilisé après un échec 404 pour forcer le rafraîchissement)
 */
async function getBuildId(force = false) {
  if (!force && buildIdCache.id && Date.now() - buildIdCache.time < BUILD_ID_TTL) {
    return buildIdCache.id;
  }
  const res = await fetch(`${BASE_URL}/`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`FotMob home error: ${res.status}`);
const html = await res.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('buildId introuvable');
  buildIdCache = { id: m[1], time: Date.now() };
  return m[1];
}

/**
 * Recherche des joueurs par nom (retourne nom + id + photo)
 * Utilise l'endpoint apigw.fotmob.com/searchapi/suggest
 */
export async function searchPlayers(name) {
  const res = await fetch(`https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(name)}&hits=8`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`FotMob API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const players = [];
  const suggest = Array.isArray(data?.squadMemberSuggest)
    ? data.squadMemberSuggest[0]?.options || []
    : data?.squadMemberSuggest?.options || [];
  for (const item of suggest) {
    const payload = item?.payload;
    const pid = Number(payload?.id);
    if (!pid || !payload?.name && !item?.text) continue;

    let playerName = payload?.name || item?.text || '';
    if (playerName.includes('|')) playerName = playerName.split('|')[0];
    if (!playerName.trim()) continue;

    players.push({
      id: pid,
      name: playerName,
      team: payload.teamName || null,
      photo: playerPhoto(pid),
    });
  }

  return players;
}

/**
 * Génère l'URL de la photo d'un joueur depuis son id FotMob
 */
function playerPhoto(playerId) {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
}

/**
 * Récupère les stats d'un joueur précis via son id (endpoint _next/data)
 */
export async function getPlayerStats(playerId) {
  // 2 tentatives max : la 2e force un nouveau buildId (les déploiements FotMob changent l'id assez souvent)
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const buildId = await getBuildId(attempt === 1);
      const url = `${BASE_URL}/_next/data/${buildId}/en/players/${playerId}/x.json`;

      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Connection: 'close', 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`FotMob player error: ${res.status} for id=${playerId}`);

      const data = await res.json();
      const pKey = Object.keys(data?.pageProps?.fallback || {}).find((k) => k.startsWith('player'));
      const player = pKey ? data.pageProps.fallback[pKey] : null;
      if (!player) throw new Error(`Joueur ${playerId} introuvable`);

      return {
        name: player.name || 'Inconnu',
        team: player.primaryTeam?.teamName || null,
        photo: playerPhoto(playerId),
        mainLeague: player.mainLeague || null,
        stats: player.mainLeague?.stats || [],
        leagueName: player.mainLeague?.leagueName || null,
        careerHistory: player.careerHistory || null,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`Echec stats joueur ${playerId}`);
}

/**
 * Normalise les stats disponibles pour un joueur (array {title, value})
 */
export function extractStats(playerData) {
  const list = playerData.stats || [];
  const get = (key) => {
    const found = list.find((s) => s.localizedTitleId === key || s.title?.toLowerCase() === key);
    return found ? Number(found.value) || 0 : null;
  };

  return {
    name: playerData.name,
    team: playerData.team,
    photo: playerData.photo,
    goals: get('goals'),
    assists: get('assists'),
    appearances: get('matches_uppercase') ?? get('matches'),
    minutesPlayed: get('minutes_played'),
    yellowCards: get('yellow_cards'),
    redCards: get('red_cards'),
    started: get('started'),
  };
}

/**
 * Alias canoniques pour comparer les noms de compétitions (les libellés FotMob
 * varient : "La Liga" côté jeu, "laliga" côté FotMob, etc.).
 */
const LEAGUE_ALIAS = {
  'premier league': 'premierleague',
  'premierleague': 'premierleague',
  'la liga': 'laliga',
  'laliga': 'laliga',
  'spanish laliga': 'laliga',
  'laliga santander': 'laliga',
  'serie a': 'seriea',
  'seriea': 'seriea',
  'serie a italie': 'seriea',
  'ligue 1': 'ligue1',
  'ligue1': 'ligue1',
  'bundesliga': 'bundesliga',
  'bundesliga allemagne': 'bundesliga',
  'serie b': 'serieb',
  'champions league': 'championsleague',
  'uefa champions league': 'championsleague',
  'championnat national': 'national',
  'saudi pro league': 'saudiproleague',
  'international': 'international',
  'friendly': 'international',
  'national team': 'international',
  'uefa euro': 'international',
  'world cup': 'international',
  'european championship': 'international',
  'fifa world cup': 'international',
  'fifa world cup qualifier': 'international',
  'copa america': 'international',
  'african cup of nations': 'international',
};

/**
 * Normalise le nom d'une compétition pour comparer entre elles
 * (minuscules, accents retirés, alias canoniques).
 */
function normLeague(name) {
  const cleaned = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  return LEAGUE_ALIAS[cleaned] || cleaned;
}

/**
 * Cumule une statistique sur TOUTE la carrière du joueur, mais uniquement dans
 * une compétition donnée (ex : "Premier League").
 * provinces : goals, assists, appearances.
 * Retourne un entier (0 si aucune donnée trouvée).
 *
 * Pour "Équipe nationale", on scanne aussi les entrées internationales
 * (careerItems.international), car FotMob n'y range pas les sélections.
 */
export function careerStatInCompetition(playerData, leagueName, stat) {
  const want = normLeague(leagueName);
  const careerItems = playerData?.careerHistory?.careerItems;
  const isNational = want === 'international';
  let sum = 0;

  const scan = (entries) => {
    for (const season of entries || []) {
      for (const t of season.tournamentStats || []) {
        if (normLeague(t.leagueName) !== want) continue;
        if (stat === 'goals+assists') {
          const g = Number(t['goals']);
          const a = Number(t['assists']);
          if (Number.isFinite(g) && g >= 0) sum += g;
          if (Number.isFinite(a) && a >= 0) sum += a;
        } else {
          const v = Number(t[stat]);
          if (Number.isFinite(v) && v >= 0) sum += v;
        }
      }
    }
  };

  scan(careerItems?.senior?.seasonEntries);
  if (isNational) scan(careerItems?.international?.seasonEntries);

  return sum;
}

/**
 * Joueurs célèbres par grande compétition, utilisés pour échantillonner les
 * ordres de grandeur réels d'une stat (cumul carrière) avant de demander une cible à l'IA.
 */
const KNOWN_COMPETITION_PLAYERS = {
  'Premier League': [
    'Mohamed Salah', 'Bruno Fernandes', 'Bukayo Saka', 'Ollie Watkins', 'Alexander Isak',
    'Cole Palmer', 'James Maddison', 'Raheem Sterling', 'Son Heung-min', 'Phil Foden',
    'Erling Haaland', 'Jack Grealish', 'Marcus Rashford', 'Kevin De Bruyne',
  ],
  'La Liga': [
    'Karim Benzema', 'Kylian Mbappe', 'Robert Lewandowski', 'Vinicius Junior', 'Rodrygo',
    'Federico Valverde', 'Jude Bellingham', 'Antoine Griezmann', 'Ousmane Dembele', 'Lamine Yamal',
  ],
  'Serie A': [
    'Ciro Immobile', 'Victor Osimhen', 'Dusan Vlahovic', 'Lautaro Martinez', 'Rafael Leao',
    'Paulo Dybala', 'Romelu Lukaku', 'Mohamed Salah', 'Lorenzo Insigne',
  ],
  'Ligue 1': [
    'Kylian Mbappe', 'Karim Benzema', 'Alexandre Lacazette', 'Ousmane Dembele', 'Wissam Ben Yedder',
    'Sadio Mane', 'Cristiano Ronaldo',
  ],
  Bundesliga: [
    'Robert Lewandowski', 'Harry Kane', 'Erling Haaland', 'Florian Wirtz', 'Jamal Musiala',
    'Ronaldinho', 'Joshua Kimmich',
  ],
  'Champions League': [
    'Cristiano Ronaldo', 'Lionel Messi', 'Karim Benzema', 'Robert Lewandowski', 'Kylian Mbappe',
    'Mohamed Salah', 'Thomas Muller', 'Thierry Henry', 'Raul Gonzalez', 'Luiz Adriano',
    'Filippo Inzaghi', 'Zinedine Zidane',
  ],
  'Europa League': [
    'Cristiano Ronaldo', 'Romelu Lukaku', 'Duvan Zapata', 'Bruno Fernandes', 'Radamel Falcao',
    'Wout Weghorst', 'Alvaro Morata', 'Hulk', 'Taison',
  ],
  'Équipe nationale': [
    'Lionel Messi', 'Cristiano Ronaldo', 'Kylian Mbappe', 'Harry Kane', 'Romelu Lukaku',
    'Memphis Depay', 'Robert Lewandowski', 'Zlatan Ibrahimovic', 'Robert Lewandowski',
  ],
};

/**
 * Sélectionne un sous-ensemble aléatoire de joueurs connus d'une compétition.
 */
export function sampleCompetitionPlayers(competition, count = 6) {
  const pool = KNOWN_COMPETITION_PLAYERS[competition] || [];
  if (pool.length === 0) return [];
  const idx = new Set();
  while (idx.size < Math.min(count, pool.length)) {
    idx.add(Math.floor(Math.random() * pool.length));
  }
  return [...idx].map((i) => pool[i]);
}

/**
 * Récupère les données complètes d'un joueur par son nom (1er résultat), ou null.
 * Utile pour l'échantillonnage des plages de statistiques.
 */
export async function fetchPlayerByName(name) {
  try {
    const list = await searchPlayers(name);
    const p = list[0];
    if (!p) return null;
    const raw = await getPlayerStats(p.id);
    return { ...raw, fotmobId: p.id };
  } catch {
    return null;
  }
}

/**
 * Estime la plage [min, max] réelle d'une stat (cumul carrière) pour un échantillon
 * de joueurs connus dans une compétition. Retourne { min, max, values } des valeurs
 * non nulles (0 ignoré : le joueur n'a probablement pas joué dans cette ligue).
 */
export async function estimateCareerRange(competition, field, players) {
  const values = [];
  const candidates = players || sampleCompetitionPlayers(competition, 6);
  for (const name of candidates) {
    try {
      const raw = await fetchPlayerByName(name);
      if (!raw) continue;
      const v = careerStatInCompetition(raw, competition, field);
      if (v > 0) values.push(v);
    } catch {
      // ignore les joueurs injoignables
    }
  }
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values), values };
}

export default {
  searchPlayers,
  getPlayerStats,
  extractStats,
  careerStatInCompetition,
  sampleCompetitionPlayers,
  fetchPlayerByName,
  estimateCareerRange,
};