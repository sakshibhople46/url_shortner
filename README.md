# Snip — URL Shortener

A full-stack URL shortener built from scratch to learn system design concepts hands-on: caching, database indexing, write buffering, rate limiting, and horizontal scalability patterns.

**Live demo:** _add your deployed link here after Step 12_

---

## Features

- Shorten long URLs into short, shareable codes
- Fast redirects via Redis caching (cache-aside pattern)
- Click analytics per short link, buffered in Redis and flushed to Postgres periodically
- Rate limiting to prevent abuse (10 requests/minute per IP)
- Collision-free short code generation (auto-increment ID + base62 encoding + obfuscation)
- Simple, responsive web UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech)) |
| Cache / Counters | Redis (hosted on [Upstash](https://upstash.com)) |
| Frontend | Plain HTML, CSS, JavaScript |
| Hosting | Render |

---

## Architecture

```
Client (browser)
      │
      ▼
Express server ──► Redis (cache-aside for redirects, click counters, rate limits)
      │
      ▼
PostgreSQL (source of truth for URLs + click counts)
```

### Key design decisions

- **Short code generation:** New URLs get an auto-incrementing DB id (guaranteed unique, no collisions). The id is obfuscated with modular multiplication before being base62-encoded, so short codes don't reveal a predictable sequence.
- **Caching (cache-aside):** Redirects check Redis first. On a miss, the app queries Postgres and populates the cache for next time. Cache entries expire after 1 hour (TTL).
- **Click tracking:** Clicks increment a Redis counter (`INCR`) instantly — no DB write on the hot path. A background job flushes counts from Redis into Postgres every 30 seconds using `GETDEL` to avoid double-counting.
- **Rate limiting:** A fixed-window counter in Redis limits each IP to 10 shorten requests/minute. Fails open (allows requests through) if Redis is unreachable, so a cache outage never blocks real users.
- **Resilience:** All Redis operations are wrapped in try/catch. If Redis goes down, the app falls back to Postgres directly rather than crashing.

---

## Project Structure

```
url-shortener/
├── public/              # Frontend (served as static files)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── server.js        # Express app + routes
│   ├── db.js             # PostgreSQL connection pool
│   ├── cache.js           # Redis cache + click counter logic
│   ├── encode.js           # Base62 encoding + id obfuscation
│   ├── rateLimiter.js       # Redis-based rate limiting middleware
│   └── analyticsFlusher.js   # Background job: Redis → Postgres click sync
├── .env                  # Secrets (not committed)
├── .gitignore
└── package.json
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/shorten` | Shorten a URL. Body: `{ "url": "https://..." }` |
| `GET` | `/:shortCode` | Redirects to the original URL |
| `GET` | `/api/stats/:shortCode` | Returns click count, original URL, created date |
| `GET` | `/health` | Health check |

---

## Running Locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root:
   ```
   DATABASE_URL=your_postgres_connection_string
   REDIS_URL=your_redis_connection_string (use rediss:// for TLS)
   PORT=3000
   ```
3. Run the schema setup SQL (see `/docs` or the table definitions below) against your Postgres instance.
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000`.

### Database schema

```sql
CREATE TABLE urls (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE,
  original_url TEXT NOT NULL,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_short_code ON urls(short_code);
```

---

## Known Limitations / Future Improvements

- No user authentication — links can't be tied to an account or managed/deleted
- Rate limiting uses a fixed window (has a known burst edge case at window boundaries); a sliding-window or token-bucket algorithm would be more accurate
- No monitoring/alerting on production errors
- Free-tier hosting may have cold-start delays after inactivity

Possible next steps: custom aliases, user accounts, QR code generation, link expiration, Docker packaging.

---

## What This Project Demonstrates

Built incrementally, one functionality at a time, to mirror how real teams ship software — starting from an in-memory prototype and evolving toward a cache-backed, horizontally-scalable architecture. Concepts covered: REST API design, database indexing, the cache-aside pattern, write buffering for high-frequency counters, rate limiting, and graceful degradation under dependency failure.