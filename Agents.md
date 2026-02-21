# Agent Mode PRD: Web Crawler Telemetry Dashboard

## 1. Overview

### Purpose
Provide a real-time, comprehensive visual interface to monitor, control, and debug the distributed web crawler. It will act as the command center for the 5-developer sprint.

### Concept: The "Mock-First" Approach
Because the backend crawler agents are currently under construction, the dashboard will utilize a Data Provider Agent layer. If the real backend APIs (Express/Redis/Mongo) are unreachable, the UI will automatically gracefully degrade to using hardcoded "backup values" so frontend development is never blocked.

## 2. Dashboard Architecture

- **Tech Stack**
  - Frontend Framework: React.js (Vite) + TypeScript (recommended for strict data contracts)
  - Styling: Tailwind CSS (rapid UI development)
  - Charting: Recharts or Chart.js (queue and memory graphs)
  - Backend BFF: Express.js (bridge between the React UI, BullMQ, and MongoDB)
  - Real-time Updates: WebSockets (Socket.io) or HTTP Polling (every 3s)

## 3. Core Dashboard Views (Features)

### View 1: The Global Command Center (Home)
- Global Status: Running, Paused, or Offline
- Total URLs Discovered: Aggregate unique URLs
- Total Pages Fetched: Successfully downloaded & parsed pages
- Current Crawl Rate: Pages fetched per second/minute
- Global Error Rate: Percentage of failed requests

### View 2: Queue & Frontier Analytics (BullMQ)
- Queue Breakdown: Active, Waiting, Delayed, Failed (dead-letter)
- Domain Grouping List: Domains with largest backlog
- Recent Logs: Live streaming text of URLs picked up by workers

### View 3: Worker Fleet Health (Infrastructure)
- Active Workers: Number of Node.js instances polling the queue
- Memory Usage (RAM): Line graph (MB over time)
- CPU Load: Processing overhead chart
- DNS Cache Size: Number of domain resolutions in memory

### View 4: Data Explorer (MongoDB)
- Latest Fetches Table: URL, HTTP Status, Page Title, Extracted Link Count
- Data Payload Viewer: Click a row to see raw JSON + HTML snippet

### View 5: Control Panel & Admin
- Seed Injector Form: Submit new starting URLs manually
- Kill Switch: Big red button to pause the BullMQ queue globally
- Flush Commands: Buttons to clear Redis queue, clear Bloom filter, or drop MongoDB collection (development only)

## 4. Frontend Data Provider Agents (With Mock Fallbacks)
These are the internal services the React app will use to fetch data. If `fetch()` fails, they return mock data.

### Agent: `QueueMetricsProvider`
- Responsibility: Fetches current BullMQ state
- Mock Backup Value:

```json
{
  "status": "connected",
  "counts": {
    "waiting": 14502,
    "active": 5,
    "completed": 8230,
    "failed": 112,
    "delayed": 450
  },
  "currentRate": "4.2 pages/sec",
  "topDomainsWaiting": [
    {"domain": "example.com", "count": 5000},
    {"domain": "wikipedia.org", "count": 3200}
  ]
}
```

### Agent: `WorkerHealthProvider`
- Responsibility: Monitors Docker/Node.js telemetry
- Mock Backup Value:

```json
{
  "workersOnline": 3,
  "metrics": [
    {"time": "10:00", "ram_mb": 120, "cpu_percent": 15},
    {"time": "10:01", "ram_mb": 125, "cpu_percent": 22},
    {"time": "10:02", "ram_mb": 123, "cpu_percent": 18}
  ],
  "dnsCacheEntries": 842
}
```

### Agent: `DataExplorerProvider`
- Responsibility: Fetches the latest 5 documents from MongoDB
- Mock Backup Value:

```json
[
  {
    "id": "64a1b2c3",
    "url": "https://example.com/about",
    "status": 200,
    "title": "About Us - Example Corp",
    "linksFound": 45,
    "timestamp": "2026-02-20T10:05:00Z"
  },
  {
    "id": "64a1b2c4",
    "url": "https://example.com/contact",
    "status": 404,
    "title": "Not Found",
    "linksFound": 0,
    "timestamp": "2026-02-20T10:05:02Z"
  }
]
```

### Agent: `ErrorLogProvider`
- Responsibility: Pulls the Dead-Letter Queue (Failed jobs)
- Mock Backup Value:

```json
[
  {"url": "https://badsite.com", "error": "Timeout exceeded (10000ms)", "attempts": 3},
  {"url": "https://secure.com", "error": "403 Forbidden - WAF Block", "attempts": 1},
  {"url": "https://hugepdf.com/file.pdf", "error": "Aborted: Invalid Content-Type", "attempts": 1}
]
```

## 5. Backend Integration Contracts (For Dev 1 & 4)
Dev 5 will expect the Express.js server to eventually serve these endpoints to replace the mock data:

| Endpoint | Method | Expected Response Payload | Maps To View |
|---------:|:------:|:------------------------:|:------------:|
| `/api/metrics/queue` | GET | `QueueMetricsProvider` mock structure | View 1 & 2 |
| `/api/metrics/system` | GET | `WorkerHealthProvider` mock structure | View 3 |
| `/api/data/recent` | GET | `DataExplorerProvider` mock structure | View 4 |
| `/api/queue/seed` | POST | `{ success: true, message: "URL queued" }` | View 5 |
| `/api/queue/pause` | POST | `{ success: true, status: "paused" }` | View 5 |

## 6. Implementation Plan for Dev 5 (The Watcher)

### Day 1: Scaffold & Mock
- Initialize React app (Vite + Tailwind)
- Create UI layout (Sidebar, header, main content)
- Implement Data Provider wrappers that return mock JSON
- Build View 1 and View 2 using static mock data

### Day 2: Expand & Interact
- Add Recharts and build RAM/CPU line charts using mock arrays
- Build Data Explorer table
- Build Seed Injector form (console.log input initially)

### Day 3: The Great Hookup
- Change Data Provider wrappers to call `fetch('http://localhost:4000/api/...')`
- If fetch fails (catch), fallback to mock data and show a yellow "Offline Mode" badge in header
- Work with Dev 1 to ensure `/api/queue/seed` POST drops a URL into BullMQ

---

If you'd like, I can also:
- scaffold the Vite + React + TypeScript project with the Data Provider wrappers and mock data, or
- add a minimal Express BFF stub that returns the same mock JSON.
