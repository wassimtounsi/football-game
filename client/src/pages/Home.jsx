import { useState, useEffect, useRef } from 'react';
import { connect } from '../lib/socket.js';
import { getPlayerId } from '../lib/identity.js';

export default function Home({ onJoinLobby, defaultName }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchingMM, setSearchingMM] = useState(false);
  const [elo, setElo] = useState(1200);
  const mmHandlerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mmHandlerRef.current) mmHandlerRef.current();
    };
  }, []);

  function validate() {
    if (!name.trim()) {
      setError('Choisis un surnom pour jouer.');
      return false;
    }
    setError('');
    return true;
  }

  function handleMatchmaking() {
    if (!validate() || searchingMM) return;
    const socket = connect();
    const playerId = getPlayerId();

    const onQueue = (payload) => {
      if (payload?.status === 'idle') {
        cleanup();
        setSearchingMM(false);
        setError('Recherche annulée.');
        return;
      }
      if (payload?.elo && payload.status === 'searching') setElo(payload.elo);
      setSearchingMM(true);
    };

    const onFound = (payload) => {
      cleanup();
      setSearchingMM(false);
      onJoinLobby({ code: payload.code, playerId, displayName: name.trim() });
    };

    function cleanup() {
      socket.off('matchmaking:found', onFound);
      socket.off('matchmaking:queue', onQueue);
      mmHandlerRef.current = null;
    }

    socket.on('matchmaking:queue', onQueue);
    socket.on('matchmaking:found', onFound);

    mmHandlerRef.current = () => {
      socket.emit('matchmaking:leave');
      cleanup();
    };

    const join = () => socket.emit('matchmaking:join', { playerId, name: name.trim() });
    if (socket.connected) join();
    else socket.once('connect', join);
  }

  function cancelMatchmaking() {
    if (mmHandlerRef.current) mmHandlerRef.current();
    setSearchingMM(false);
  }

  function handleCreate() {
    if (!validate()) return;
    setCreating(true);
    const socket = connect();
    const playerId = getPlayerId();

    socket.once('connect', () => {
      socket.emit('room:create', { playerId, name: name.trim() }, (res) => {
        setCreating(false);
        if (res?.error) {
          setError(res.error);
          return;
        }
        onJoinLobby({ code: res.code, playerId, displayName: name.trim() });
      });
    });

    if (socket.connected) {
      socket.emit('room:create', { playerId, name: name.trim() }, (res) => {
        setCreating(false);
        if (res?.error) {
          setError(res.error);
          return;
        }
        onJoinLobby({ code: res.code, playerId, displayName: name.trim() });
      });
    }
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const socket = connect();
    const playerId = getPlayerId();

    if (socket.connected) {
      socket.emit('room:join', { code: code.trim(), playerId, name: name.trim() }, (res) => {
        setLoading(false);
        if (res?.error) {
          setError(res.error);
          return;
        }
        onJoinLobby({ code: code.trim().toUpperCase(), playerId, displayName: name.trim() });
      });
    } else {
      socket.once('connect', () => {
        socket.emit('room:join', { code: code.trim(), playerId, name: name.trim() }, (res) => {
          setLoading(false);
          if (res?.error) {
            setError(res.error);
            return;
          }
          onJoinLobby({ code: code.trim().toUpperCase(), playerId, displayName: name.trim() });
        });
      });
    }
  }

  return (
    <>
      <div className="hero">
        <h1>
          Le jeu <span style={{ color: 'var(--gold)' }}>gamarha</span>
        </h1>
        <p>
          Trouve 3 joueurs dont la somme approche le plus possible d'une cible mystère.
          Le plus proche gagne la manche.
        </p>
      </div>

      <div className="how">
        <div className="step">
          <div className="num">1</div>
          <p>Un défi est généré : une statistique, une compétition et une cible secrète.</p>
        </div>
        <div className="step">
          <div className="num">2</div>
          <p>Chaque joueur choisit 3 joueurs réels grâce à la recherche avec photos.</p>
        </div>
        <div className="step">
          <div className="num">3</div>
          <p>Le système additionne les stats réelles de tes 3 joueurs. La somme la plus proche gagne.</p>
        </div>
      </div>

      <div className="card home-actions">
        <div className="field">
          <label>Ton surnom</label>
          <input
            className="input"
            placeholder="Ex: BenzemaFan"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'var(--danger)', marginTop: 0 }}>{error}</p>}

        <button className="btn primary block" onClick={handleCreate} disabled={creating}>
          {creating ? 'Création...' : 'Créer une partie'}
        </button>

        <button
          className="btn success block"
          style={{ marginTop: 10 }}
          onClick={searchingMM ? cancelMatchmaking : handleMatchmaking}
          disabled={creating}
        >
          {searchingMM
            ? `Recherche d'un adversaire (Elo ${elo})...`
            : 'Partie classée (matchmaking)'}
        </button>
        {searchingMM && (
          <p className="bet-progress">
            <span className="spinner" />
            En attente d'un adversaire de même niveau...
          </p>
        )}

        <div className="division">ou</div>

        <form onSubmit={handleJoin}>
          <div className="field">
            <label>Rejoindre avec un code</label>
            <input
              className="input"
              placeholder="Code (ex: K4T9XY)"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: 2 }}
            />
          </div>
          <button className="btn outline block" type="submit" disabled={loading}>
            {loading ? 'Rejoindre...' : 'Rejoindre la partie'}
          </button>
        </form>
      </div>
    </>
  );
}