import { useEffect, useRef, useState } from 'react';
import { connect } from '../lib/socket.js';
import { searchPlayers } from '../lib/api.js';

const MAX_PICKS = 3;

export default function Game({ code, playerId, name, challenge, players, phase, revealed, betProgress, onRestart }) {
  const [myPicks, setMyPicks] = useState([]); // [{id, name, team, photo}]
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [localProgress, setLocalProgress] = useState(betProgress);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const searchTimer = useRef(null);

  // Compte à rebours pour la phase de pari
  useEffect(() => {
    if (phase.status === 'betting' && phase.deadline) {
      const tick = () => {
        const left = Math.max(0, phase.deadline - Date.now());
        setCountdown(Math.ceil(left / 1000));
        if (left <= 0) clearInterval(interval);
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  useEffect(() => {
    if (betProgress) setLocalProgress(betProgress);
  }, [betProgress]);

  // Recherche joueurs avec debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await searchPlayers(query.trim());
        setResults(found.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  function addPlayer(p) {
    if (myPicks.length >= MAX_PICKS) return;
    if (myPicks.some((x) => x.id === p.id)) return;
    setMyPicks([...myPicks, p]);
    setQuery('');
    setResults([]);
    setShowSuggestions(false);
  }

  function removePlayer(id) {
    setMyPicks(myPicks.filter((x) => x.id !== id));
  }

  function submitBet() {
    if (myPicks.length !== MAX_PICKS) return;
    setSubmitting(true);
    const socket = connect();
    // on envoie les joueurs sélectionnés (id + infos d'affichage) pour pouvoir
    // afficher le vrai nom/tête même si la stat détaillée échoue côté serveur
    socket.emit('bet:place', { code, playerId, players: myPicks }, (res) => {
      setSubmitting(false);
      if (res?.error) {
        alert(res.error);
        return;
      }
      setHasBet(true);
    });
  }

  // --- PHASE RESULTATS ---
  if (revealed) {
    const isHost = players && players[0]?.id === playerId;
    return <ResultsView revealed={revealed} name={name} playerId={playerId} isHost={isHost} onRestart={onRestart} />;
  }

  const challengeActive = challenge || phase.status === 'betting';

  // État "attente des autres" après avoir parié
  const waitingOthers = hasBet || localProgress?.placed >= (localProgress?.total || 0);
  const bettingOpen = phase.status === 'betting';

  return (
    <div>
      {/* Bannière défi */}
      {challengeActive && (
        <div className="challenge-banner">
          {countdown !== null && (
            <div className="muted" style={{ letterSpacing: 1 }}>
              Temps restant : <b style={{ color: 'var(--gold)' }}>{countdown}s</b>
            </div>
          )}
          <div className="comp">
            {challenge?.competition || 'Compétition secrète'}
          </div>
          <div className="muted">La cible à approcher est :</div>
          <div className="target-number">{challenge?.target ?? '???'}</div>
          <div className="muted">
            Compose une équipe de 3 joueurs pour un total en{' '}
            <b style={{ color: 'var(--text)' }}>{challenge?.statistic || 'statistique'}</b>.
          </div>
        </div>
      )}

      {/* Sélection des joueurs */}
      <div className="card">
        <h2>Ton équipe</h2>
        {bettingOpen && !waitingOthers ? (
          <>
            <div className="picker">
              <input
                className="input"
                placeholder="Recherche un joueur (ex: Mbappé)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                disabled={myPicks.length >= MAX_PICKS}
              />
              {showSuggestions && query.trim().length >= 2 && (
                <div className="suggestions">
                  {searching && <div className="no-results"><span className="spinner" />Recherche...</div>}
                  {!searching && results.length === 0 && (
                    <div className="no-results">Aucun joueur trouvé pour « {query} »</div>
                  )}
                  {results.map((p) => (
                    <div key={p.id} className="suggestion" onClick={() => addPlayer(p)}>
                      <img className="s-photo" src={p.photo || '/user.svg'} alt={p.name} />
                      <div>
                        <div className="s-name">{p.name}</div>
                        <div className="s-team">{p.team || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="team-grid">
              {Array.from({ length: MAX_PICKS }).map((_, i) => {
                const p = myPicks[i];
                return (
                  <div key={i} className={'slot' + (p ? ' filled' : '')}>
                    {p ? (
                      <>
                        <button className="remove" onClick={() => removePlayer(p.id)}>×</button>
                        <img src={p.photo || '/user.svg'} alt={p.name} />
                        <div className="slot-name">{p.name}</div>
                        <div className="slot-team">{p.team || ''}</div>
                      </>
                    ) : (
                      <span className="muted">Slot {i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className="btn primary block"
              style={{ marginTop: 16 }}
              disabled={myPicks.length !== MAX_PICKS || submitting}
              onClick={submitBet}
            >
              {myPicks.length}/{MAX_PICKS} joueurs {submitting ? '— Envoi...' : '— Valider mon pronostic'}
            </button>
          </>
        ) : (
          <div className="bet-progress">
            <span className="spinner" />
            En attente des autres joueurs... ({localProgress?.placed ?? 0}/{localProgress?.total ?? players.length} pronostics)
          </div>
        )}
      </div>

      {/* Scores en direct */}
      {!bettingOpen && challengeActive && (
        <div className="card">
          <h3>En attente du lancement...</h3>
          <p className="muted">Le défi a été généré, l'hôte va lancer la manche.</p>
        </div>
      )}
    </div>
  );
}

// ==== Vue résultats ====
function ResultsView({ revealed, name, playerId, isHost, onRestart }) {
  const { target, statistic, competition, cumulative, results, winners, leaderboard } = revealed;
  const sorted = [...(results || [])].sort((a, b) => a.diff - b.diff);

  return (
    <div>
      <div className="challenge-banner">
        <div className="comp">{competition}</div>
        <div className="muted">Statistique : <b style={{ color: 'var(--text)' }}>{statistic}</b>
          {cumulative && (
            <span className="muted" style={{ fontSize: 11 }}>
              {' '}(cumulée sur toute la carrière dans {competition})
            </span>
          )}
        </div>
        <div className="muted">Cible à approcher :</div>
        <div className="target-number">{target}</div>
      </div>

      <h2>Résultats</h2>
      {sorted.map((r) => (
        <div key={r.playerId} className={'result-card' + (winners.includes(r.playerId) ? ' winner' : '')}>
          <div className="result-head">
            {winners.includes(r.playerId) && <span className="crown">👑</span>}
            <strong>{r.name}</strong>
            {r.playerId === playerId && <span className="muted">(toi)</span>}
            <span className={'result-total ' + (r.diff === 0 ? 'diff-good' : r.diff <= 8 ? 'diff-good' : 'diff-bad')}>
              {r.total}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Écart à la cible : {r.diff}
          </div>
          <ul className="picked-list">
            {r.details?.map((d, i) => (
              <li key={i}>
                <img src={d.photo || '/user.svg'} alt={d.name} />
                <span>{d.name || 'Joueur'}</span>
                <span className="val">+{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Classement global */}
      {leaderboard && leaderboard.length > 0 && (
        <div className="card">
          <h3>Classement</h3>
          <ol className="leaderboard">
            {leaderboard.slice(0, 10).map((e, i) => (
              <li key={e.userId}>
                <span className="rank">{i + 1}</span>
                <span>{e.name || 'Joueur'}</span>
                <span className="record">{e.wins}V / {e.losses}D</span>
                <span className="elo">{e.elo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {isHost ? (
        <button className="btn success block" onClick={onRestart}>
          Rejouer
        </button>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>
          En attente que l'hôte lance la prochaine manche...
        </p>
      )}
    </div>
  );
}