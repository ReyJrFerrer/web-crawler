# Scalable Web Crawler

A distributed, intelligent web crawler system built with Bun, Redis, MongoDB, BullMQ, Puppeteer, Cheerio, and Axios. Follows a massively scalable architecture inspired by search-engine bots.

## Features Included (Phase 2)
- **Renderer Agent (SPA Support):** Executes JavaScript to render dynamic Single Page Applications before parsing using headless Chromium.
- **Fault-Tolerant URL Frontier:** Distributed messaging queue via Redis (`bull`) with message un-ack and Dead-Letter Queue (DLQ) for crash recovery.
- **Politeness & Rate Limiting:** Enforces `robots.txt`, dynamic exponential backoff on HTTP 429/503s, and per-domain timeouts (default 2s).
- **Spider Trap & Domain Protection:** Prevents infinite loops via URL depth limits, path-repetition detection, and Domain Restriction Filtering.
- **Content Duplicate Eliminator:** Computes Simhash (64-bit FNV-1a) fingerprints to drop near-duplicates or mirror sites.
- **Storage Optimizer:** Compresses raw HTML using Brotli/Gzip and seamlessly supports S3-compatible Object Storage (e.g., DigitalOcean Spaces) with strict 30-day TTL lifecycle rules.
- **Kubernetes Scaling:** Built-in manifests and a unified CLI tool for dynamic horizontal scaling of fetcher replica pods via the Kubernetes API.
- **Extensibility Layer:** Pluggable parser architecture to easily hook in Elasticsearch indexing or NLP extraction modules.
- **Live Dashboard:** React/Vite UI providing real-time metrics, queue visualization, and system controls.

## Prerequisites

- **Docker Desktop** (with Kubernetes enabled for local testing)
- **Bun** (Runtime)
- **kubectl** (configured to point to your local or remote cluster)

## 1. Local Infrastructure (Redis & MongoDB)

The crawler requires Redis (queue) and MongoDB (metadata storage). Start the backing infrastructure via docker-compose:
```bash
docker compose up -d
```

## 2. Standalone Execution (No Kubernetes)

If you just want to run everything locally in a single process without Kubernetes:

1. **Install dependencies**
   ```bash
   bun install
   ```
2. **Install Chromium (for the Renderer Agent)**
   ```bash
   npx puppeteer browsers install chrome
   ```
3. **Start the Orchestrator / Worker**
   This boots up the Fetcher agent locally, listening to the Redis Frontier, and exposes the Dashboard on port 4000.
   ```bash
   bun run start
   ```

## 3. Distributed Execution (Docker & Kubernetes)

To run the crawler in a highly scalable, distributed manner, the Orchestrator and Fetcher Workers are separated using the `ROLE` environment variable.

### Step 3.1: Build the Docker Image
Containerize the fetcher application (includes Bun and Puppeteer/Chromium):
```bash
docker build -t web-crawler:local .
```

### Step 3.2: Deploy to Local Kubernetes
Apply the Kubernetes manifests. The fetcher pods will connect to your local Redis/Mongo via `host.docker.internal`.
```bash
kubectl apply -f k8s/local/configmap.yaml
kubectl apply -f k8s/local/deployment.yaml
```

*Note: For production, refer to the manifests in `k8s/doks/` for DigitalOcean Kubernetes integration.*

### Step 3.3: Start the Orchestrator
Run the central orchestrator locally. In `ROLE=orchestrator` mode (default), this process *will not* fetch URLs itself. Instead, it monitors the Redis queue globally, serves the Dashboard UI, and streams live logs indicating which Kubernetes pod fetched which URL.
```bash
bun run start
```

## 4. Using the System

### Injecting Seeds
Send URLs to the queue to begin crawling:
```bash
bun run seed -- --urls "https://example.com"
```

### Unified CLI Dashboard
Manage the distributed cluster and queue from the command line:
```bash
bun run cli
```
**CLI Features:**
- **View Active Fetchers:** Queries the K8s API to list all active `crawler-fetcher` pods and their statuses.
- **Scale Fetchers:** Dynamically adjusts the replica count (e.g., from 1 to 50 workers) via the K8s API.
- **Monitor Queue:** Displays real-time URL fetch statistics (active, waiting, completed, failed).
- **Queue Control Panel:** Pause, Resume, or Empty the Redis frontier queue on the fly.
- **Decompress HTML:** Selects and decompresses Brotli/Gzip optimized HTML from Object Storage or MongoDB for local viewing.

### Web Dashboard
Open your browser to `http://localhost:4000` to access the React-based visual dashboard for real-time queue metrics and system controls.

## Checking the Database
Connect to MongoDB via your preferred client (e.g., MongoDB Compass) at `mongodb://localhost:27017/crawler`.
- `parsedData`: Contains the extracted page titles, URLs array, and plugin extracted metadata.
- `rawHtml`: Contains the exact payload downloaded from targets (if S3 is not configured).

## Key Environment Variables
The application can be configured by editing `.env` or `k8s/local/configmap.yaml`:
- `ROLE`: `orchestrator` (default) or `fetcher` (used inside K8s pods).
- `FETCHER_CONCURRENCY`: Default 10. Number of jobs executed simultaneously per instance.
- `CRAWL_DELAY_MS`: Default 2000. Time delayed between fetches per domain.
- `MAX_DEPTH`: Default 5. Max depth from the initial seed injection.
- `USE_RENDERER`: Default `true`. Enables Puppeteer SPA rendering.
- `COMPRESSION_ALGO`: Default `brotli`. Algorithm used before saving to storage.
