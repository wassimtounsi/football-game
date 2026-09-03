import { io } from 'socket.io-client';

let socket = null;

const SERVER_URL = import.meta.env.VITE_API_URL || '';

export function connect() {
  if (socket) return socket;
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnect() {
  if (socket) socket.disconnect();
  socket = null;
}

export default { connect, getSocket, disconnect };