const express = require('express');
const crypto = require('crypto');
const pool = require('./db');
const { startAnalyticsFlusher } = require('./analyticsFlusher');
const { encodeBase62, obfuscateId } = require('./encode');
const { getCachedUrl, setCachedUrl, incrementClickCount } = require('./cache');
const rateLimiter = require('./rateLimiter');

const app = express();
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static('public'));
const BASE62_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateShortCode(length = 6) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }
  return code;
}

function isValidUrl(str) {
  try {
    const parsed = new URL(str);

    // Only allow http/https — blocks javascript:, data:, file:, etc.
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Prevent absurdly long URLs
    if (str.length > 2048) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/shorten',rateLimiter, async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'A valid "url" is required in the request body' });
  }

  try {
    // Step 1: insert the URL, let Postgres assign a guaranteed-unique id
    const insertResult = await pool.query(
      'INSERT INTO urls (original_url) VALUES ($1) RETURNING id',
      [url]
    );
    const newId = insertResult.rows[0].id;

    // Step 2: encode that id into a short base62 code
    const obfuscated = obfuscateId(newId);        // <-- new line
    const shortCode = encodeBase62(obfuscated);  

    // Step 3: save the code back onto that same row
    await pool.query(
      'UPDATE urls SET short_code = $1 WHERE id = $2',
      [shortCode, newId]
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
    shortCode,
    shortUrl: `${baseUrl}/${shortCode}`,
    originalUrl: url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const cachedUrl = await getCachedUrl(shortCode);
    if (cachedUrl) {
      console.log(`Cache HIT for ${shortCode}`);
      incrementClickCount(shortCode); // fire-and-forget, don't await
      return res.redirect(302, cachedUrl);
    }

    console.log(`Cache MISS for ${shortCode}`);

    const result = await pool.query(
      'SELECT original_url FROM urls WHERE short_code = $1',
      [shortCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    const originalUrl = result.rows[0].original_url;
    await setCachedUrl(shortCode, originalUrl);
    incrementClickCount(shortCode); // fire-and-forget

    res.redirect(302, originalUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/api/stats/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const result = await pool.query(
      'SELECT short_code, original_url, click_count, created_at FROM urls WHERE short_code = $1',
      [shortCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 3000;
startAnalyticsFlusher();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});