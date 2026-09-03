import { useEffect, useState } from 'react';
import { connect } from '../lib/socket.js';
import Game from './Game.jsx';

const BADGES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function Lobby({ code, playerId, name }) {
  const [players, setPlayers] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [phase, setPhase] = useState({ status: 'lobby' });
  const [revealed, setRevealed] = useState(null);
  const [betProgress, setBetProgress] = useState(null);
  const [round, setRound] = useState(0);
  const [copyMsg, setCopyMsg] = useState(false);

  useEffect(() => {
    const socket = connect();

    function onPlayersUpdate(list) {
      setPlayers(list);
    }
    function onChallenge(c) {
      // Un nouveau défi arrive => nouvelle manche. On efface les résultats de
      // l'ancienne manche et on remonte <Game> à zéro (round++).
      setChallenge(c);
      setRevealed(null);
      setBetProgress(null);
      setRound((r) => r + 1);
    }
    function onPhase(p) {
      setPhase(p);
    }
    function onReveal(r) {
      setRevealed(r);
    }
    function onBetProgress(p) {
      setBetProgress(p);
    }

    socket.on('players:update', onPlayersUpdate);
    socket.on('challenge', onChallenge);
    socket.on('phase', onPhase);
    socket.on('reveal', onReveal);
    socket.on('bet:progress', onBetProgress);

    // Demande l'état de la salle au serveur
    socket.emit('room:sync', { code, playerId }, (state) => {
      if (state?.error) return;
      if (state.room) setPlayers(state.room.players);
      if (state.challenge) setChallenge(state.challenge);
      if (state.phase) setPhase(state.phase);
      if (state.revealed) setRevealed(state.revealed);
      if (state.betProgress) setBetProgress(state.betProgress);
    });

    return () => {
      socket.off('players:update', onPlayersUpdate);
      socket.off('challenge', onChallenge);
      socket.off('phase', onPhase);
      socket.off('reveal', onReveal);
      socket.off('bet:progress', onBetProgress);
      // NOTE: on ne ré-émet pas room:leave ici. La déconnexion du socket
      // (disconnect) gère les départs réels. Appeler room:leave ici pouvait
      // supprimer la salle à cause du double-montage de React StrictMode.
    };
  }, [code, playerId]);

  const isHostPlayer = players.length > 0 && players[0].id === playerId;

  function startGame() {
    const socket = connect();
    socket.emit('room:start', { code }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 1500);
    });
  }

  // Rejouer dans la même salle (mêmes joueurs) : remet en phase de pari
  // et demande un nouveau défi au serveur (room:start génère un défi frais).
  function restartGame() {
    setChallenge(null);
    setRevealed(null);
    setPhase({ status: 'lobby' });
    setBetProgress(null);
    const socket = connect();
    socket.emit('room:start', { code }, (res) => {
      if (res?.error) alert(res.error);
    });
  }

  // Phase de jeu
  if (phase.status === 'betting' || phase.status === 'revealed' || phase.status === 'finished') {
    return (
      <Game
        key={round}
        code={code}
        playerId={playerId}
        name={name}
        challenge={challenge}
        players={players}
        phase={phase}
        revealed={revealed}
        betProgress={betProgress}
        onRestart={restartGame}
      />
    );
  }

  return (
    <div className="card">
      <h2>Salle d'attente</h2>
      <div className="lobby-code">
        <div className="big-code">{code}</div>
        <button className="copy-btn" onClick={copyCode}>
          {copyMsg ? 'Copié!' : 'Copier le code'}
        </button>
      </div>
      <p className="muted">
        Partage ce code à tes amis pour qu'ils rejoignent la partie.
      </p>

      <h3>Joueurs ({players.length})</h3>
      <ul className="players-list">
        {players.map((p, i) => (
          <li key={p.id}>
            <div className="avatar">{p.name?.[0]?.toUpperCase() || '?'}</div>
            <span>{p.name}</span>
            {p.id === players[0]?.id && <span className="host-tag">Hôte</span>}
            <span className="muted" style={{ marginLeft: 'auto' }}>#{BADGES[i]}</span>
          </li>
        ))}
      </ul>

      <button
        className="btn success block"
        disabled={!isHostPlayer}
        onClick={startGame}
      >
        {isHostPlayer ? 'Lancer la manche' : 'En attente de l\'hôte...'}
      </button>
      <p className="bet-progress">{players.length < 2 ? '2 joueurs minimum pour lancer.' : 'Tout est prêt à démarrer !'}</p>
    </div>
  );
}