# Agent Mode PRD: Scalable Web Crawler System
**3-Day Sprint Implementation Guide**

## 1. Overview

### Purpose
Build a distributed, intelligent web crawler system with autonomous agent capabilities for scalable data ingestion, similar to search engine bots (Googlebot).

### Sprint Goal
Deliver a functional MVP that crawls, parses, and stores web content with basic politeness policies and horizontal scalability.


### Methodology
Implement a Test-Driven Development Methodology, write tests are implementing the function, do not determine that the task is done if there are lint issues or incomplete/failed tests. 

### Current Tools
Bun
---

## 2. System Architecture

### Core Components (Priority Order)

#### Day 1: Foundation Layer 
1. **URL Frontier** (Message Queue)
   - Tech: Redis or RabbitMQ
   - Features: FIFO queue, domain-based partitioning
   - Priority: P0 (Critical)

2. **Fetcher Agent Fleet**
   - Tech: Node.js with async HTTP (axios/node-fetch)
   - Features: URL consumption, HTTP download, rate limiting per domain
   - Priority: P0 (Critical)

3. **Storage Subsystem**
   - Tech: MongoDB for metadata + local filesystem for raw HTML
   - Features: Store raw HTML, basic metadata (URL, timestamp, status)
   - Priority: P0 (Critical)

#### Day 2: Intelligence Layer
4. **Parser & Extractor Agent**
   - Tech: Cheerio (Node.js) or BeautifulSoup (Python)
   - Features: Extract text, metadata, outbound links
   - Priority: P0 (Critical)

5. **Duplicate Eliminator Agent**
   - Tech: In-memory Bloom Filter (bloomfilter.js)
   - Features: URL deduplication only (content dedup = P2)
   - Priority: P1 (High)

6. **DNS Cache**
   - Tech: Node.js in-memory cache with TTL
   - Features: Cache DNS lookups for 1 hour
   - Priority: P1 (High)

#### Day 3: Orchestration & Policies
7. **Seed Injector**
   - Tech: Simple REST API or CLI script
   - Features: Inject initial URLs into Frontier
   - Priority: P0 (Critical)

8. **Politeness Policy Manager**
   - Tech: Embedded in Fetcher
   - Features: robots.txt check, crawl delay (2s default), User-Agent header
   - Priority: P0 (Critical)

9. **Monitoring Dashboard** (Optional)
   - Tech: Simple web UI (React) or CLI status script
   - Features: Queue size, fetch rate, error count
   - Priority: P2 (Nice-to-have)

---

## 3. Agent Behaviors

### Fetcher Agent
**Autonomy Level:** Semi-autonomous
- **Input:** URL from Frontier
- **Actions:**
  1. Check DNS cache (resolve if miss)
  2. Validate robots.txt compliance
  3. Apply domain-specific rate limit (2s delay)
  4. Download HTML
  5. Send to Storage + Parser
  6. ACK message to Frontier
- **Error Handling:** Retry 3x, then dead-letter queue

### Parser Agent
**Autonomy Level:** Autonomous
- **Input:** Raw HTML from Storage
- **Actions:**
  1. Extract text content
  2. Extract all `<a href>` links
  3. Normalize URLs (absolute paths)
  4. Send URLs to Duplicate Eliminator
  5. Store parsed data to MongoDB
- **Error Handling:** Log and skip malformed HTML

### Duplicate Eliminator Agent
**Autonomy Level:** Autonomous
- **Input:** URLs from Parser
- **Actions:**
  1. Check Bloom Filter
  2. If new: Add to Bloom Filter + push to Frontier
  3. If seen: Drop silently
- **Error Handling:** N/A (stateless)

---

## 4. Data Flow

```
Seed Injector → URL Frontier
                      ↓
                Fetcher Agent → DNS Cache
                      ↓
              Storage (Raw HTML)
                      ↓
                Parser Agent
                      ↓
           Duplicate Eliminator
                      ↓
              URL Frontier (loop)
```

---

## 5. Technical Specifications

### Tech Stack
- **Language:** Node.js (TypeScript optional)
- **Message Queue:** Redis (with `bull` library)
- **Database:** MongoDB
- **HTTP Client:** `axios` with retry logic
- **Parser:** `cheerio`
- **Containerization:** Docker + docker-compose
- **Orchestration:** Manual for MVP (Kubernetes = future)

### Infrastructure
- **Local Development:** Docker Compose with 3 containers
  - Redis (Frontier)
  - MongoDB (Storage)
  - Node.js app (all agents)
- **Scaling:** Add more Node.js containers (Day 3 stretch goal)

---

## 6. Sprint Breakdown

### Day 1: Core Pipeline (8 hours)
**Goal:** Crawl 1 URL end-to-end

**Tasks:**
1. Setup: Docker Compose (Redis + MongoDB + Node) - 1h
2. URL Frontier: Redis queue with `bull` - 1h
3. Fetcher Agent: Download HTML with `axios` - 2h
4. Storage: Save raw HTML to MongoDB - 1h
5. Seed Injector: CLI script to push seed URLs - 1h
6. Integration Test: Crawl `example.com` - 2h

**Deliverable:** Can crawl and store 1 URL

---

### Day 2: Intelligence + Loop (8 hours)
**Goal:** Extract links and re-queue new URLs

**Tasks:**
1. Parser Agent: Extract text + links with `cheerio` - 2h
2. URL Normalization: Handle relative/absolute paths - 1h
3. Duplicate Eliminator: Bloom Filter integration - 2h
4. Connect Parser → Eliminator → Frontier - 1h
5. DNS Cache: In-memory cache with 1h TTL - 1h
6. Integration Test: Crawl depth-2 (follow 1 link) - 1h

**Deliverable:** Can crawl 2-level deep sites

---

### Day 3: Production-Ready (8 hours)
**Goal:** Politeness + fault tolerance

**Tasks:**
1. Politeness Manager:
   - robots.txt parser + cache - 2h
   - Per-domain rate limiting (2s delay) - 1h
   - User-Agent header - 0.5h
2. Fault Tolerance:
   - Retry logic (3x with backoff) - 1h
   - Dead-letter queue for failed URLs - 1h
3. Monitoring:
   - CLI status command (queue size, stats) - 1h
4. Documentation: README + deployment guide - 1h
5. Load Test: Crawl 100 URLs - 0.5h

**Deliverable:** Production-ready MVP

---

## 7. Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379
MONGO_URL=mongodb://localhost:27017/crawler
FETCHER_CONCURRENCY=10
CRAWL_DELAY_MS=2000
MAX_DEPTH=3
USER_AGENT="MyCrawler/1.0 (+http://example.com/bot)"
```

### Politeness Defaults
- **Crawl Delay:** 2 seconds per domain
- **Max Concurrent/Domain:** 1
- **robots.txt Cache:** 24 hours
- **Request Timeout:** 10 seconds

---

## 8. Non-Functional Requirements

### Performance (MVP)
- **Throughput:** 10-50 pages/sec (single Fetcher)
- **Latency:** < 5s per page
- **Storage:** ~1MB per page (raw HTML)

### Reliability
- **Uptime:** 95% (manual restart acceptable)
- **Data Loss:** Acceptable if Fetcher crashes (no persistence for queue yet)
- **Retry Policy:** 3 attempts with exponential backoff

### Scalability (Future)
- **Horizontal Scaling:** Add Fetcher containers (Day 3 stretch)
- **Vertical Scaling:** Increase `FETCHER_CONCURRENCY`

---

## 9. Known Limitations (MVP Scope)

### Out of Scope (P2/P3)
- ❌ JavaScript rendering (Puppeteer)
- ❌ Content deduplication (Simhash)
- ❌ Advanced prioritization (domain authority)
- ❌ Distributed tracing (OpenTelemetry)
- ❌ Indexing (Elasticsearch integration)
- ❌ Image/media extraction
- ❌ URL depth limits (spider trap protection)

### Simplified for Sprint
- Single Redis instance (no cluster)
- MongoDB single node (no replica set)
- In-process agents (no separate microservices)
- Manual seed injection (no continuous feed)

---

## 10. Testing Strategy

### Unit Tests (Optional for Sprint)
- URL normalization logic
- Bloom Filter accuracy
- robots.txt parser

### Integration Tests (Required)
1. **Test 1:** Seed → Fetch → Store
2. **Test 2:** Parse → Extract Links → Re-queue
3. **Test 3:** Duplicate detection (same URL twice)
4. **Test 4:** robots.txt disallow enforcement

### Load Test (Day 3)
- Crawl 100 URLs from a test domain
- Monitor: Queue backlog, error rate, storage growth

---

## 11. Success Metrics

### Sprint Goals
- ✅ Crawl depth-2 successfully
- ✅ Zero duplicate URLs fetched
- ✅ robots.txt compliance verified
- ✅ 95%+ fetch success rate
- ✅ Documentation complete

### Post-Sprint
- 1000+ URLs crawled
- < 5% error rate
- No IP blocks from target sites

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Redis connection drops** | Implement reconnect logic with `bull` |
| **MongoDB write bottleneck** | Batch inserts (10 docs/batch) |
| **robots.txt malformed** | Default to 2s delay if parse fails |
| **Infinite loop (spider trap)** | Add max depth check (depth=3) |
| **DNS resolution slow** | Cache aggressively (1h TTL) |

---

## 13. Deployment

### Local Setup
```bash
# Clone repo
git clone <repo-url>
cd web-crawler

# Start infrastructure
docker-compose up -d

# Install dependencies
npm install

# Run crawler
npm start

# Inject seeds
npm run seed -- --urls "http://example.com"
```

### Production (Future)
- Kubernetes deployment with Helm charts
- Horizontal Pod Autoscaler for Fetchers
- Managed Redis (AWS ElastiCache)
- Managed MongoDB (MongoDB Atlas)

---

## 14. Future Enhancements (Post-Sprint)

1. **JavaScript Rendering:** Puppeteer pool for SPAs
2. **Content Deduplication:** Simhash for near-duplicate detection
3. **Advanced Prioritization:** PageRank-style URL scoring
4. **Distributed Tracing:** OpenTelemetry integration
5. **Auto-scaling:** Kubernetes HPA based on queue depth
6. **Dashboard:** Real-time crawl status UI
7. **API:** RESTful API for seed injection + status queries

---

## 15. Team Responsibilities

### Day 1 (Foundation)
- **Developer 1:** Redis Frontier + Seed Injector
- **Developer 2:** Fetcher Agent + Storage
- **Developer 3:** Docker setup + Integration test

### Day 2 (Intelligence)
- **Developer 1:** Parser Agent
- **Developer 2:** Duplicate Eliminator + DNS Cache
- **Developer 3:** Loop integration + Testing

### Day 3 (Production)
- **Developer 1:** Politeness Manager
- **Developer 2:** Fault tolerance + Dead-letter queue
- **Developer 3:** Monitoring + Documentation

---

## Appendix: Quick Reference

### Key Files
```
/src
  /agents
    - fetcher.js       # Downloads HTML
    - parser.js        # Extracts data
    - eliminator.js    # Deduplicates
  /services
    - frontier.js      # Redis queue wrapper
    - storage.js       # MongoDB wrapper
    - dns-cache.js     # DNS cache
  /utils
    - robots.js        # robots.txt parser
    - normalizer.js    # URL normalization
  - index.js           # Main orchestrator
```

### External Dependencies
```json
{
  "axios": "^1.6.0",
  "bull": "^4.12.0",
  "cheerio": "^1.0.0-rc.12",
  "mongodb": "^6.3.0",
  "bloomfilter": "^0.0.20"
}
```

---

**End of Document**