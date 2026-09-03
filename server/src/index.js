import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import playersRouter from './routes/players.js';
import challengesRouter from './routes/challenges.js';
import roomsRouter from './routes/rooms.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const origins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'gamarha', time: new Date().toISOString() });
});

app.use('/api/players', playersRouter);
app.use('/api/challenges', challengesRouter);
app.use('/api/rooms', roomsRouter);

const io = new Server(server, {
  cors: { origin: origins, methods: ['GET', 'POST'] },
});

setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[gamarha] Server listening on http://localhost:${PORT}`);
});