import { v4 as uuidv4 } from 'uuid';
import { norm, overlap } from './utils.js';

/**
 * Wait queues keyed by interest token. Each entry: { socket, profile }
 * profile = { university, interests:[], lookingSince:number }
 */
const queues = new Map();

function getQueue(key) {
  if (!queues.has(key)) queues.set(key, []);
  return queues.get(key);
}

export function enqueue(socket, profile) {
  const interests = profile.interests?.length ? profile.interests : ["any"];
  const now = Date.now();
  for (const raw of interests) {
    const key = norm(raw) || 'any';
    const q = getQueue(key);
    q.push({ socket, profile: { ...profile, lookingSince: now } });
  }
}

export function dequeue(socketId) {
  for (const [key, q] of queues) {
    const idx = q.findIndex(x => x.socket.id === socketId);
    if (idx !== -1) q.splice(idx, 1);
  }
}

export function tryMatch(incomingSocket, incomingProfile) {
  const interests = incomingProfile.interests?.length ? incomingProfile.interests : ["any"];
  const candidates = new Map(); // socketId -> { socket, profile }

  // Gather unique candidates across all interest queues
  for (const raw of interests) {
    const key = norm(raw) || 'any';
    const q = getQueue(key);
    for (const entry of q) {
      candidates.set(entry.socket.id, entry);
    }
  }

  // Filter by constraints: not same socket; must share >=1 interest; prefer different universities
  const byAge = [...candidates.values()].sort((a,b) => a.profile.lookingSince - b.profile.lookingSince);

  let chosen = null;
  for (const cand of byAge) {
    if (cand.socket.id === incomingSocket.id) continue;
    const shares = overlap(incomingProfile.interests || ["any"], cand.profile.interests || ["any"]);
    if (!shares) continue;
    const differentUni = norm(cand.profile.university) !== norm(incomingProfile.university);
    if (differentUni) { chosen = cand; break; }
    if (!chosen) chosen = cand; // fallback if no diff-uni candidate
  }

  if (!chosen) return null;

  // Remove both from all queues
  dequeue(incomingSocket.id);
  dequeue(chosen.socket.id);

  const roomId = uuidv4();
  return { roomId, partner: chosen };
}