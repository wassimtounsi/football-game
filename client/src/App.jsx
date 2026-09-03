import { useState } from 'react';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';
import { connect } from './lib/socket.js';
import { getPlayerName, setPlayerName } from './lib/identity.js';

export default function App() {
  const [route, setRoute] = useState({ view: 'home' });
  const [name, setName] = useState(getPlayerName());
  const [socketKey, setSocketKey] = useState(0);

  function handleJoinLobby({ code, playerId, displayName }) {
    setName(displayName);
    setPlayerName(displayName);
    setRoute({ view: 'lobby', code, playerId, name: displayName });
  }

  function goHome() {
    // Départ explicite : on laisse la salle (room:leave gère les départs volontaires)
    if (route.view === 'lobby' || route.view === 'game') {
      const socket = connect();
      socket.emit('room:leave', { code: route.code, playerId: route.playerId });
    }
    setRoute({ view: 'home' });
    setSocketKey((k) => k + 1);
  }

  return (
    <div className="wrap">
      <header className="app-header">
        <div className="logo">
          gamarha<span>.</span>
        </div>
        {route.view !== 'home' && (
          <div>
            <button className="logout-btn" onClick={goHome}>Quitter</button>
          </div>
        )}
      </header>

      {route.view === 'home' && (
        <Home onJoinLobby={handleJoinLobby} defaultName={name} />
      )}

      {route.view === 'lobby' && (
        <Lobby key={socketKey} code={route.code} playerId={route.playerId} name={route.name} />
      )}

      {/* Si le lobby passe en phase de jeu, il rend <Game/> en interne */}
      {route.view === 'game' && (
        <Game code={route.code} playerId={route.playerId} name={route.name} onExit={goHome} />
      )}
    </div>
  );
}