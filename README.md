# Scalable Web Crawler

A distributed, intelligent web crawler system built with Bun, Redis, MongoDB, BullMQ, Cheerio, and Axios. Follows a scalable architecture inspired by search-engine bots.

## Features Included (Day 1 - Day 3)
- **URL Frontier:** Distributed messaging queue via Redis (`bull`) ensuring fault-tolerance and retry capabilities.
- **Politeness Manager:** Complies with standard `robots.txt` restrictions with a 24-hour cache layer.
- **Per-Domain Rate Limiting:** Enforces timeouts (default 2s) between domain-specific requests to prevent hammering target servers.
- **Intelligence Layer:** In-memory Bloom Filter to quickly eliminate duplicates and `cheerio` HTML parsing.
- **DNS Caching:** Implements `cacheable-lookup` over standard Axios requests to reduce DNS resolution times.
- **Monitoring Tools:** Simple CLI interface for keeping an eye on queue statuses and dead-lettered domains.

## Infrastructure

The crawler requires Redis and MongoDB.
Start the backing infrastructure via docker-compose:
```bash
docker compose up -d
```

## Setup & Running

1. **Install dependencies**
   ```bash
   bun install
   ```
2. **Start the Crawler (Orchestrator)**
   This boots up the Fetcher agent, Parser, and Eliminator, and attaches them to the Redis Frontier.
   ```bash
   bun run start
   ```
3. **Inject Seeds**
   In a separate terminal window, send URLs to the queue:
   ```bash
   bun run seed -- --urls "https://example.com"
   ```
4. **Monitor Progress**
   Check the real-time status of the queues:
   ```bash
   bun run monitor
   ```

## Checking the Database
Connect to MongoDB via your preferred client (e.g. MongoDB Compass) at `mongodb://localhost:27017/crawler`.
- `rawHtml`: Contains the exact payload downloaded from targets.
- `parsedData`: Contains the extracted page titles and URLs array.

## Environment Variables
The application can be configured by editing `.env`.
- `FETCHER_CONCURRENCY`: Default 10. Number of jobs executed at the same time per instance.
- `CRAWL_DELAY_MS`: Default 2000. Time delayed between fetches per-domain.
- `MAX_DEPTH`: Default 3. Max depth from the initial seed injection.
