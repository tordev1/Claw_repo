/**
 * Redis Client — optional caching and pub/sub for horizontal scaling
 * Falls back gracefully when Redis is not available.
 */

const config = require('./config');

let redis = null;
let subscriber = null;
let isConnected = false;

/**
 * Initialize Redis connection if REDIS_URL is configured
 */
async function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[redis] REDIS_URL not set — using in-memory fallback');
    return null;
  }

  try {
    const Redis = require('ioredis');
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });

    await redis.connect();
    isConnected = true;
    console.log('[redis] Connected to Redis');

    redis.on('error', (err) => {
      console.error('[redis] Connection error:', err.message);
      isConnected = false;
    });

    redis.on('reconnecting', () => {
      console.log('[redis] Reconnecting...');
    });

    redis.on('ready', () => {
      isConnected = true;
    });

    return redis;
  } catch (err) {
    console.warn(`[redis] Failed to connect: ${err.message} — using in-memory fallback`);
    redis = null;
    return null;
  }
}

/**
 * Initialize a separate subscriber connection for pub/sub
 */
async function initSubscriber(onMessage) {
  if (!redis) return null;

  try {
    const Redis = require('ioredis');
    subscriber = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await subscriber.connect();

    subscriber.subscribe('ws:broadcast', (err) => {
      if (err) console.error('[redis] Subscribe error:', err.message);
      else console.log('[redis] Subscribed to ws:broadcast channel');
    });

    subscriber.on('message', (channel, message) => {
      if (channel === 'ws:broadcast' && onMessage) {
        try {
          onMessage(JSON.parse(message));
        } catch (e) {
          console.error('[redis] Message parse error:', e.message);
        }
      }
    });

    return subscriber;
  } catch (err) {
    console.warn(`[redis] Subscriber failed: ${err.message}`);
    return null;
  }
}

// ── Cache helpers ───────────────────────────────────────────────────────────
async function cacheGet(key) {
  if (!redis || !isConnected) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 30) {
  if (!redis || !isConnected) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
}

async function cacheDel(pattern) {
  if (!redis || !isConnected) return;
  try {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  } catch { /* silent */ }
}

// ── Pub/Sub for cross-instance WS broadcasting ─────────────────────────────
async function publish(event, data, filters) {
  if (!redis || !isConnected) return false;
  try {
    await redis.publish('ws:broadcast', JSON.stringify({ event, data, filters }));
    return true;
  } catch { return false; }
}

// ── Rate limiter store for @fastify/rate-limit ─────────────────────────────
function getRateLimitStore() {
  if (!redis || !isConnected) return undefined; // falls back to in-memory
  return {
    type: 'redis',
    client: redis,
  };
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
async function closeRedis() {
  if (subscriber) { try { subscriber.disconnect(); } catch {} }
  if (redis) { try { redis.disconnect(); } catch {} }
  isConnected = false;
}

module.exports = {
  initRedis,
  initSubscriber,
  cacheGet,
  cacheSet,
  cacheDel,
  publish,
  getRateLimitStore,
  closeRedis,
  getClient: () => redis,
  isReady: () => isConnected,
};
