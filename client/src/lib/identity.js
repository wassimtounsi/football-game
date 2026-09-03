// Identité persistée du joueur (localStorage)

export function getPlayerId() {
  let id = localStorage.getItem('gamarha_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('gamarha_player_id', id);
  }
  return id;
}

export function getPlayerName() {
  return localStorage.getItem('gamarha_player_name') || '';
}

export function setPlayerName(name) {
  localStorage.setItem('gamarha_player_name', name);
}