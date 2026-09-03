// Lerp layer API
const API = import.meta.env.VITE_API_URL || '';

export async function searchPlayers(name) {
  const res = await fetch(`${API}/api/players/search?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Erreur recherche joueurs');
  const data = await res.json();
  return data.players || [];
}

export async function getPlayerStats(id) {
  const res = await fetch(`${API}/api/players/${id}/stats`);
  if (!res.ok) throw new Error('Erreur stats joueur');
  return res.json();
}

export default { searchPlayers, getPlayerStats };