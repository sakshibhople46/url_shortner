require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 4) {
      console.error('Redis: too many retries, giving up reconnect attempts for now');
      return null; // stop retrying
    }
    return Math.min(times * 200, 2000); // backoff: 200ms, 400ms, ... up to 2s
  }
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

const TTL_SECONDS = 60 * 60;

async function getCachedUrl(shortCode) {
  try {
    return await redis.get(`url:${shortCode}`);
  } catch (err) {
    console.error('Redis GET failed, falling back to DB:', err.message);
    return null; // treat as cache miss, don't crash the request
  }
}

async function setCachedUrl(shortCode, originalUrl) {
  try {
    await redis.set(`url:${shortCode}`, originalUrl, 'EX', TTL_SECONDS);
  } catch (err) {
    console.error('Redis SET failed, continuing without cache:', err.message);
    // not fatal — the redirect will still work, just uncached this time
  }
}
async function incrementClickCount(shortCode) {
  try {
    await redis.incr(`clicks:${shortCode}`);
  } catch (err) {
    console.error('Redis INCR failed (click not counted this time):', err.message);
    // Not fatal — we deliberately don't fail the redirect just because a click wasn't counted
  }
}

module.exports = { getCachedUrl, setCachedUrl, incrementClickCount };
