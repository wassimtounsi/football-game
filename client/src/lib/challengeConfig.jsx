// Logos des ligues et équipes (FotMob CDN)
// Format: { nom: { logo: url, short: nom court } }

const FOTMOB_LEAGUE_LOGO = (id) => `https://images.fotmob.com/image_resources/logo/leaguelogo/${id}.png`;
const FOTMOB_TEAM_LOGO = (id) => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

export const LEAGUES = {
  'Premier League': { logo: FOTMOB_LEAGUE_LOGO(47), short: 'PL' },
  'La Liga': { logo: FOTMOB_LEAGUE_LOGO(87), short: 'LaLiga' },
  'Serie A': { logo: FOTMOB_LEAGUE_LOGO(55), short: 'SerieA' },
  'Ligue 1': { logo: FOTMOB_LEAGUE_LOGO(53), short: 'L1' },
  'Bundesliga': { logo: FOTMOB_LEAGUE_LOGO(54), short: 'BuLi' },
  'Champions League': { logo: FOTMOB_LEAGUE_LOGO(4), short: 'UCL' },
  'Europa League': { logo: FOTMOB_LEAGUE_LOGO(67), short: 'UEL' },
  'Équipe nationale': { logo: null, short: 'NAT' },
};

export const TEAMS = {
  'Real Madrid CF': { logo: FOTMOB_TEAM_LOGO(8633), short: 'RMA' },
  'FC Barcelona': { logo: FOTMOB_TEAM_LOGO(8634), short: 'FCB' },
  'Atletico Madrid': { logo: FOTMOB_TEAM_LOGO(9906), short: 'ATM' },
  'Manchester City': { logo: FOTMOB_TEAM_LOGO(8456), short: 'MCI' },
  'Liverpool FC': { logo: FOTMOB_TEAM_LOGO(8650), short: 'LIV' },
  'Arsenal FC': { logo: FOTMOB_TEAM_LOGO(9825), short: 'ARS' },
  'Chelsea FC': { logo: FOTMOB_TEAM_LOGO(8455), short: 'CHE' },
  'Manchester United': { logo: FOTMOB_TEAM_LOGO(10260), short: 'MUN' },
  'Tottenham Hotspur': { logo: FOTMOB_TEAM_LOGO(8586), short: 'TOT' },
  'Aston Villa': { logo: FOTMOB_TEAM_LOGO(10252), short: 'AVL' },
  'Bayern München': { logo: FOTMOB_TEAM_LOGO(9823), short: 'BAY' },
  'Borussia Dortmund': { logo: FOTMOB_TEAM_LOGO(9789), short: 'BVB' },
  'Bayer Leverkusen': { logo: FOTMOB_TEAM_LOGO(8178), short: 'B04' },
  'RB Leipzig': { logo: FOTMOB_TEAM_LOGO(178475), short: 'RBL' },
  'Juventus': { logo: FOTMOB_TEAM_LOGO(9885), short: 'JUV' },
  'AC Milan': { logo: FOTMOB_TEAM_LOGO(8564), short: 'ACM' },
  'Inter Milan': { logo: FOTMOB_TEAM_LOGO(8636), short: 'INT' },
  'SSC Napoli': { logo: FOTMOB_TEAM_LOGO(9875), short: 'NAP' },
  'Roma': { logo: FOTMOB_TEAM_LOGO(8686), short: 'ROM' },
  'Paris Saint-Germain': { logo: FOTMOB_TEAM_LOGO(9847), short: 'PSG' },
  'Olympique Marseille': { logo: FOTMOB_TEAM_LOGO(8592), short: 'OM' },
  'AS Monaco': { logo: FOTMOB_TEAM_LOGO(9829), short: 'ASM' },
};

// Icônes SVG pour les statistiques
export const STAT_ICONS = {
  goals: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  ),
  assists: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  ),
  'goals+assists': (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  appearances: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  yellowCards: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  ),
  redCards: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  ),
};

// Couleur des stats
export const STAT_COLORS = {
  goals: 'var(--accent-2)',
  assists: 'var(--accent)',
  'goals+assists': 'var(--gold)',
  appearances: 'var(--muted)',
  yellowCards: '#f0c040',
  redCards: 'var(--danger)',
};

// Labels courts des stats
export const STAT_SHORT = {
  goals: 'Buts',
  assists: 'PD',
  'goals+assists': 'G+A',
  appearances: 'MJ',
  yellowCards: 'CJ',
  redCards: 'CR',
};
