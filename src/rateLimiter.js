const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL);

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

async function rateLimiter(req, res, next) {
  const ip = req.ip;
  const currentWindow = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${ip}:${currentWindow}`;

  try {
    const count = await redis.incr(key);

    // On the first request in this window, set the key to expire
    // so we don't leave stale rate-limit keys sitting in Redis forever
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests. Please try again in a minute.'
      });
    }

    next(); // under the limit, allow the request through
  } catch (err) {
    console.error('Rate limiter error, allowing request through:', err.message);
    // Fail open: if Redis is down, don't block real users because of it
    next();
  }
}

module.exports = rateLimiter;