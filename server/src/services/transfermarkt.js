import dotenv from 'dotenv';

dotenv.config();

const TM = 'https://www.transfermarkt.com';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HTML_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.transfermarkt.com/',
};

const JSON_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.transfermarkt.com/',
};

/**
 * Correspondance compétitions du jeu -> code compétition Transfermarkt.
 * Codes vérifiés sur données réelles (GB1=Premier League, ES1=La Liga,
 * IT1=Serie A, FR1=Ligue 1, L1=Bundesliga, CL=Champions, EL=Europa League).
 */
const COMPETITION_CODE = {
  'premierleague': ['GB1'],
  'laliga': ['ES1'],
  'seriea': ['IT1'],
  'ligue1': ['FR1'],
  'bundesliga': ['L1'],
  'championsleague': ['CL'],
  'europaleague': ['EL'],
  'saudiproleague': ['SA1'],
  'serieb': ['IT2'],
};

/**
 * Équipes du jeu (TOP_TEAMS de fotmob.js) -> id club Transfermarkt.
 * Les ids sont résolus via la recherche Transfermarkt.
 */
const TEAM_CLUB_ID = {
  'realmadridcf': '418',
  'fcbarcelona': '131',
  'atleticomadrid': '13',
  'manchestercity': '281',
  'liverpoolfc': '31',
  'arsenalfc': '11',
  'chelseafc': '631',
  'manchesterunited': '985',
  'tottenhamhotspur': '148',
  'bayernmunich': '27',
  'bayern': '27',
  'borussiadortmund': '16',
  'bayerleverkusen': '90',
  'juventus': '506',
  'acmilan': '5',
  'intermilan': '46',
  'sscnapoli': '6195',
  'parissaint-germain': '583',
  'psg': '583',
  'olympiquemarseille': '244',
  'asmonaco': '162',
  'alnassrfc': '6053',
  'alhilalsfc': '6086',
  'galatasaraysk': '993',
  'fenerbahcesk': '36',
  'sportingcp': '2708',
  'benfica': '294',
};

/**
 * Normalise une chaîne (minuscules, sans accents, non-alphanum retirés)
 * pour comparer noms de compétitions / équipes.
 */
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Cache simple en mémoire des stats carrière récupérées (par id Transfermarkt). */
const careerCache = new Map();
const CAREER_TTL = 6 * 60 * 60 * 1000; // 6h

/**
 * Recherche un joueur sur Transfermarkt par nom.
 * Retourne le premier résultat senior : { id, name } ou null.
 */
export async function searchPlayerByName(name) {
  if (!name) return null;
  try {
    const res = await fetch(`${TM}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`, {
      headers: HTML_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Premier résultat "hauptlink" de type joueur (/profil/spieler/ID)
    const m = html.match(/class="hauptlink"><a title="[^"]*" href="[^"]*\/profil\/spieler\/(\d+)"[^>]*>([^<]+)</);
    if (!m) return null;
    return { id: m[1], name: m[2].replace(/&amp;/g, '&').trim() };
  } catch {
    return null;
  }
}

/**
 * Récupère les stats par match de toute la carrière d'un joueur et les agrège.
 * Retourne un objet avec :
 *   - parCompetition: { [codeTM]: { yellow, red, minutes, games } }
 *   - parClub:        { [clubId]: { yellow, red, minutes, games } }
 *   - national:       { yellow, red, minutes, games }   (matchs internationaux)
 *   - total
 * Le payload contient aussi un flag sur la fiabilité (succès API).
 */
async function fetchCareerStats(tmId) {
  const cached = careerCache.get(tmId);
  if (cached && Date.now() - cached.time < CAREER_TTL) return cached.data;

  const url = `${TM}/ceapi/performance-game/${tmId}`;
  const res = await fetch(url, {
    headers: JSON_HEADERS,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Transfermarkt error: ${res.status} for tmId=${tmId}`);
  const json = await res.json();
  const data = json?.data;
  const list = Array.isArray(data?.performance) ? data.performance : [];

  const byComp = {};
  const byClub = {};
  const national = { yellow: 0, red: 0, minutes: 0, games: 0 };
  const total = { yellow: 0, red: 0, minutes: 0, games: 0 };

  for (const p of list) {
    const gi = p?.gameInformation || {};
    const cs = p?.statistics?.cardStatistics || {};
    const pts = p?.statistics?.playingTimeStatistics || {};
    const gs = p?.statistics?.generalStatistics || {};

    const yellow = Number(cs.yellowCardNet) || (cs.yellowCard ? 1 : 0) || 0;
    const isRed = !!(cs.redCard || cs.yellowRedCard);
    const red = isRed ? 1 : 0;
    const minutes = Number(pts.playedMinutes) || 0;

    total.yellow += yellow;
    total.red += red;
    total.minutes += minutes;
    total.games += 1;

    if (gi.isNationalGame) {
      national.yellow += yellow;
      national.red += red;
      national.minutes += minutes;
      national.games += 1;
    }

    const compCode = gi.competitionId;
    if (compCode) {
      if (!byComp[compCode]) byComp[compCode] = { yellow: 0, red: 0, minutes: 0, games: 0 };
      byComp[compCode].yellow += yellow;
      byComp[compCode].red += red;
      byComp[compCode].minutes += minutes;
      byComp[compCode].games += 1;
    }

    const clubId = gs.primaryClubId;
    if (clubId) {
      const ck = String(clubId);
      if (!byClub[ck]) byClub[ck] = { yellow: 0, red: 0, minutes: 0, games: 0 };
      byClub[ck].yellow += yellow;
      byClub[ck].red += red;
      byClub[ck].minutes += minutes;
      byClub[ck].games += 1;
    }
  }

  const out = { byCompetition: byComp, byClub, national, total };
  careerCache.set(tmId, { data: out, time: Date.now() });
  return out;
}

/**
 * Retourne la valeur carrière d'une stat (yellowCards / redCards / minutesPlayed)
 * pour un joueur Transfermarkt dans une COMPÉTITION du jeu.
 */
export async function careerStatInCompetition(tmId, competition, stat) {
  const career = await fetchCareerStats(tmId);
  const want = norm(competition);

  if (want === 'equipenationale' || want === 'international') {
    return pick(national(career), stat);
  }

  const codes = COMPETITION_CODE[want] || [];
  let sum = 0;
  for (const code of codes) {
    const s = career.byCompetition[code];
    if (s) sum += pick(s, stat);
  }
  return sum;
}

/**
 * Retourne la valeur carrière d'une stat pour un joueur Transfermarkt dans une ÉQUIPE.
 */
export async function careerStatForTeam(tmId, teamName, stat) {
  const career = await fetchCareerStats(tmId);
  const want = norm(teamName);
  const clubId = TEAM_CLUB_ID[want];
  if (!clubId) return 0;
  const s = career.byClub[clubId];
  return s ? pick(s, stat) : 0;
}

function national(career) {
  return career.national || { yellow: 0, red: 0, minutes: 0, games: 0 };
}

function pick(entry, stat) {
  switch (stat) {
    case 'yellowCards': return entry.yellow || 0;
    case 'redCards': return entry.red || 0;
    case 'minutesPlayed': return entry.minutes || 0;
    default: return 0;
  }
}

/**
 * Estime la plage [min, max] réelle d'une stat carrière (cartes / minutes) pour
 * un échantillon de joueurs (noms) dans une compétition.
 */
export async function estimateCareerRange(competition, field, names) {
  const values = [];
  for (const nm of names || []) {
    try {
      const p = await searchPlayerByName(nm);
      if (!p) continue;
      const v = await careerStatInCompetition(p.id, competition, field);
      if (v > 0) values.push(v);
    } catch {
      // ignore les joueurs injoignables
    }
  }
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values), values };
}

/**
 * Estime la plage [min, max] d'une stat carrière pour une ÉQUIPE donnée.
 */
export async function estimateCareerRangeForTeam(team, field, names) {
  const values = [];
  for (const nm of names || []) {
    try {
      const p = await searchPlayerByName(nm);
      if (!p) continue;
      const v = await careerStatForTeam(p.id, team, field);
      if (v > 0) values.push(v);
    } catch {
      // ignore
    }
  }
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values), values };
}

export default {
  searchPlayerByName,
  careerStatInCompetition,
  careerStatForTeam,
  estimateCareerRange,
  estimateCareerRangeForTeam,
};
