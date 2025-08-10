import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { enqueue, dequeue, tryMatch } from './matchmaker.js';
import { checkRate } from './rateLimit.js';
import { UNIVERSITIES, norm } from './utils.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json());

const origins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

app.get('/health', (req,res)=> res.json({ ok:true, time: Date.now() }));
app.get('/universities', (req,res)=> res.json(UNIVERSITIES));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: origins.length ? origins : '*' }
});

io.on('connection', (socket) => {
  // simple rate limit per socket for chat spam
  const safeEmit = (event, payload) => {
    if (!checkRate(socket.id)) return; // drop silently if abusive
    socket.emit(event, payload);
  };

  socket.on('find_partner', (profile) => {
    // shape: { university, interests: string[] }
    try {
      const cleanProfile = {
        university: String(profile?.university || '').slice(0, 80),
        interests: (Array.isArray(profile?.interests) ? profile.interests : [])
          .map(s => String(s).slice(0, 40)).slice(0, 10)
      };

      // quick validation
      if (!cleanProfile.university) {
        safeEmit('match_error', { message: 'University is required.' });
        return;
      }

      // try instant match
      const hit = tryMatch(socket, cleanProfile);
      if (hit) {
        const { roomId, partner } = hit;
        socket.join(roomId);
        partner.socket.join(roomId);
        io.to(roomId).emit('match_found', {
          roomId,
          you: { id: socket.id, university: cleanProfile.university },
          partner: { id: partner.socket.id, university: partner.profile.university }
        });
        return;
      }

      // else queue and wait
      enqueue(socket, cleanProfile);
      safeEmit('queued', { message: 'Waiting for a partner…' });
    } catch (e) {
      safeEmit('match_error', { message: 'Could not process your request.' });
    }
  });

  socket.on('send_message', ({ roomId, text }) => {
    if (!checkRate(socket.id)) return; // drop spam
    const clean = String(text || '').slice(0, 2000);
    if (!roomId || !clean) return;
    io.to(roomId).emit('message', { from: socket.id, text: clean, ts: Date.now() });
  });

  socket.on('typing', ({ roomId, state }) => {
    if (!roomId) return;
    socket.to(roomId).emit('typing', { from: socket.id, state: !!state });
  });

  socket.on('skip', () => {
    // leave rooms and requeue
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    dequeue(socket.id);
    socket.emit('skipped');
  });

  socket.on('disconnect', () => {
    dequeue(socket.id);
  });
});

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});