// Very light, in-memory rate limiter (per socket id)
const WINDOW_MS = 4000; // 4 seconds
const MAX_EVENTS = 15;  // messages per window

const buckets = new Map();

export function checkRate(socketId) {
  const now = Date.now();
  const winStart = now - WINDOW_MS;
  const bucket = buckets.get(socketId) || [];
  const recent = bucket.filter(t => t > winStart);
  recent.push(now);
  buckets.set(socketId, recent);
  return recent.length <= MAX_EVENTS;
}