import { LEAGUES, TEAMS, STAT_ICONS, STAT_COLORS, STAT_SHORT } from '../lib/challengeConfig';

/**
 * Affiche une bannière de défi avec logo (ligue/équipe), icône stat, cible et description.
 * Utilisée pendant la phase de pari ET dans les résultats.
 */
export default function ChallengeBanner({ challenge, revealed, countdown, compact }) {
  const data = revealed || challenge || {};
  const { target, statistic, field, competition, team, framing, cumulative } = data;

  const contextName = team || competition;
  const isTeam = !!team;

  const logoInfo = isTeam ? TEAMS[team] : LEAGUES[competition];
  const logoUrl = logoInfo?.logo;
  const shortName = logoInfo?.short || contextName;

  const statIcon = STAT_ICONS[field] || STAT_ICONS[field?.split('+')[0]];
  const statColor = STAT_COLORS[field] || 'var(--text)';
  const statShort = STAT_SHORT[field] || statistic;

  return (
    <div className={'challenge-banner' + (compact ? ' compact' : '')}>
      {/* Countdown */}
      {countdown !== null && countdown !== undefined && (
        <div className="cb-countdown">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {countdown}s
        </div>
      )}

      {/* Header: logo + context */}
      <div className="cb-header">
        {logoUrl ? (
          <img className="cb-logo" src={logoUrl} alt={contextName} />
        ) : (
          <div className="cb-logo cb-logo-fallback">{isTeam ? '⚽' : '🌍'}</div>
        )}
        <div className="cb-context">
          <div className="cb-context-name">{contextName}</div>
          <div className="cb-context-type">{isTeam ? 'Club' : 'Compétition'}</div>
        </div>
      </div>

      {/* Stat badge */}
      <div className="cb-stat-badge" style={{ borderColor: statColor }}>
        <span className="cb-stat-icon" style={{ color: statColor }}>{statIcon}</span>
        <span className="cb-stat-label" style={{ color: statColor }}>{statShort}</span>
      </div>

      {/* Target */}
      <div className="cb-target">{target ?? '???'}</div>

      {/* Framing / description */}
      <div className="cb-framing">
        {framing || `Choisis 3 joueurs pour atteindre le plus proche de ${target} ${statShort}.`}
      </div>

      {/* Cumul note */}
      {cumulative && (
        <div className="cb-cumulative">
          Cumulé sur toute la carrière {team ? 'avec ' + team : 'dans ' + competition}
        </div>
      )}
    </div>
  );
}
