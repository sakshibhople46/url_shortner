const pool = require('./db');
const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL);

async function flushClickCounts() {
  try {
    // SCAN instead of KEYS - doesn't block Redis, even with many keys
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', 'clicks:*', 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    if (keys.length === 0) return;

    for (const key of keys) {
      const shortCode = key.replace('clicks:', '');

      // GETDEL: read the value and delete the key in one atomic step,
      // so we never double-count clicks that arrive during the flush
      const count = await redis.getdel(key);

      if (count && parseInt(count) > 0) {
        await pool.query(
          'UPDATE urls SET click_count = click_count + $1 WHERE short_code = $2',
          [parseInt(count), shortCode]
        );
      }
    }

    console.log(`Flushed click counts for ${keys.length} short code(s)`);
  } catch (err) {
    console.error('Error flushing click counts:', err.message);
  }
}

function startAnalyticsFlusher(intervalMs = 30000) {
  setInterval(flushClickCounts, intervalMs);
  console.log(`Analytics flusher started (every ${intervalMs / 1000}s)`);
}

module.exports = { startAnalyticsFlusher };