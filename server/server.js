import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { enqueue, dequeue, tryMatch } from './matchmaker.js';
import { checkRate } from './rateLimit.js';
import { UNIVERSITIES } from './utils.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json());

const origins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({ origin: origins.length ? origins : true }));

app.get('/health', (req, res) => res.json({ ok: true, time: Date.now() }));
app.get('/universities', (req, res) => res.json(UNIVERSITIES));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins.length ? origins : '*' } });

function endSession(roomId, reason = 'ended') {
  if (!roomId) return;

  const room = io.sockets.adapter.rooms.get(roomId);
  const members = room ? [...room] : [];

  if (members.length) {
    // notify first (while sockets are still in the room), then detach
    for (const sid of members) {
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      s.emit('session_ended', { reason, canRequeue: !!s.data?.profile });
    }
    for (const sid of members) {
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      s.leave(roomId);
      if (s.data) s.data.roomId = null;
    }
  } else {
    io.to(roomId).emit('session_ended', { reason, canRequeue: true });
  }
}

function endSessionBySocket(socket, reason = 'ended') {
  const roomId = socket?.data?.roomId;
  if (roomId) endSession(roomId, reason);
}

io.on('connection', (socket) => {
  const safeEmit = (event, payload) => {
    if (!checkRate(socket.id)) return;
    socket.emit(event, payload);
  };

  socket.on('find_partner', (profile) => {
    try {
      const cleanProfile = {
        university: String(profile?.university || '').slice(0, 80),
        interests: (Array.isArray(profile?.interests) ? profile.interests : [])
          .map(s => String(s).slice(0, 40))
          .slice(0, 10),
      };

      if (!cleanProfile.university) {
        safeEmit('match_error', { message: 'University is required.' });
        return;
      }

      // save for requeue
      socket.data.profile = cleanProfile;

      // ensure no stale room
      if (socket.data.roomId) endSession(socket.data.roomId, 'ended');

      const hit = tryMatch(socket, cleanProfile);
      if (hit) {
        const { roomId, partner } = hit;
        socket.join(roomId);
        partner.socket.join(roomId);

        socket.data.roomId = roomId;
        partner.socket.data.roomId = roomId;

        // compute common interests
        const youInterests = cleanProfile.interests || [];
        const partnerInterests = partner.profile.interests || [];
        const norm = s => String(s).trim().toLowerCase();
        const commonSet = new Set();
        for (const a of youInterests) {
          for (const b of partnerInterests) {
            if (norm(a) === norm(b)) commonSet.add(a.trim());
          }
        }
        const commonInterests = [...commonSet];

        io.to(roomId).emit('match_found', {
          roomId,
          you: { id: socket.id, university: cleanProfile.university, interests: youInterests },
          partner: { id: partner.socket.id, university: partner.profile.university, interests: partnerInterests },
          commonInterests,
        });
        return;
      }

      enqueue(socket, cleanProfile);
      safeEmit('queued', { message: 'Waiting for a partner…' });
    } catch {
      safeEmit('match_error', { message: 'Could not process your request.' });
    }
  });

  socket.on('requeue', () => {
    if (!checkRate(socket.id)) return;
    const saved = socket.data?.profile;
    if (!saved || !saved.university) {
      safeEmit('match_error', { message: 'No saved preferences to requeue.' });
      return;
    }
    if (socket.data?.roomId) endSession(socket.data.roomId, 'ended');

    const hit = tryMatch(socket, saved);
    if (hit) {
      const { roomId, partner } = hit;
      socket.join(roomId);
      partner.socket.join(roomId);

      socket.data.roomId = roomId;
      partner.socket.data.roomId = roomId;

      const youInterests = saved.interests || [];
      const partnerInterests = partner.profile.interests || [];
      const norm = s => String(s).trim().toLowerCase();
      const commonSet = new Set();
      for (const a of youInterests) {
        for (const b of partnerInterests) {
          if (norm(a) === norm(b)) commonSet.add(a.trim());
        }
      }
      const commonInterests = [...commonSet];

      io.to(roomId).emit('match_found', {
        roomId,
        you: { id: socket.id, university: saved.university, interests: youInterests },
        partner: { id: partner.socket.id, university: partner.profile.university, interests: partnerInterests },
        commonInterests,
      });
      return;
    }

    enqueue(socket, saved);
    safeEmit('queued', { message: 'Waiting for a partner…' });
  });

  socket.on('send_message', ({ roomId, text }) => {
    if (!checkRate(socket.id)) return;
    const clean = String(text || '').slice(0, 2000);
    const r = roomId || socket?.data?.roomId;
    if (!r || !clean) return;
    io.to(r).emit('message', { from: socket.id, text: clean, ts: Date.now() });
  });

  socket.on('typing', ({ roomId, state }) => {
    const r = roomId || socket?.data?.roomId;
    if (!r) return;
    socket.to(r).emit('typing', { from: socket.id, state: !!state });
  });

  socket.on('skip', () => {
    endSessionBySocket(socket, 'skip');
    dequeue(socket.id);
    socket.emit('skipped');
  });

  socket.on('leave', () => {
    endSessionBySocket(socket, 'left');
    dequeue(socket.id);
  });

  // Use 'disconnecting' while still in rooms
  socket.on('disconnecting', () => {
    if (socket.data?.roomId) {
      endSession(socket.data.roomId, 'disconnect');
    } else {
      for (const room of socket.rooms) {
        if (room !== socket.id) endSession(room, 'disconnect');
      }
    }
  });

  socket.on('disconnect', () => {
    dequeue(socket.id);
  });
});

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
