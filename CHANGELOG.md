Feb 24, 2026
Developer: Opencode
- Decompression CLI Tool:
    - Added a new CLI service `DecompressorService` alongside the frontier to fetch and decompress HTML files from Object Storage or MongoDB fallback.
    - Updated `StorageService` with a `getMetadataList` method to retrieve available documents and their metadata.
    - Integrated `prompts` library for an interactive CLI experience to select stored HTML documents.
    - Allowed users to specify the output path for the downloaded and decompressed HTML.
    - Implemented comprehensive unit tests in `tests/decompressor.test.ts`.
    - Added `decompress` script to `package.json` for easy execution (`bun run decompress`).

Feb 23, 2026
Developer: Reynaldo
- Integrate DigitalOcean Spaces (S3 Object Storage):
    - Added `@aws-sdk/client-s3` dependency.
    - Updated `S3ObjectStorageAdapter` to use the official AWS SDK to connect to DigitalOcean Spaces.
    - Implemented `setupLifecycle` method in the adapter to dynamically configure a 30-day auto-deletion lifecycle rule on the bucket, satisfying the data retention requirements.
    - Updated `StorageService` to prioritize saving compressed HTML blobs to DigitalOcean Spaces when configured, storing only the `s3Key` reference in MongoDB.
    - Modified `getRawHtml` to gracefully fetch and decompress data directly from the S3 bucket using stream parsing, while maintaining fallback support for legacy MongoDB-stored buffers.
    - Added comprehensive mocks and tests in `tests/storage.test.ts` to validate S3 logic without incurring network overhead.
    - Configured new environment variables in `config.ts` (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
    - Implemented robust error handling for DigitalOcean Spaces AccessDenied (HTTP 403) errors during lifecycle configuration.

- Indexer Integration / Extensibility Layer:
    - Fixed data pipeline bug to ensure `extractedData` from plugins is successfully passed through `FetcherAgent` and persisted to MongoDB via `StorageService`.
    - Refactored `ParserAgent` to support a pluggable architecture with `ParserPlugin` interface.
    - Updated `parse` method to run asynchronously to support promise-based plugins.
    - Created `extract` and `index` lifecycle hooks for plugins to seamlessly process and index data.
    - Added plugins in `src/plugins/index.ts`: `MetadataExtractorPlugin` for SEO/OG metadata extraction and `ElasticsearchIndexerPlugin` for real-time document indexing to Elasticsearch via API.
    - Updated `FetcherAgent` and test suites to accommodate the new asynchronous parser.
    - Exported and wired configuration environment variables for Elasticsearch (`ELASTICSEARCH_NODE`, `ELASTICSEARCH_INDEX`, `ELASTICSEARCH_API_KEY`) into the crawler orchestration flow.

- Fault Tolerance Manager:
    - Leveraged Bull's native stalled jobs un-ack mechanism for crash recovery by ensuring appropriate `lockDuration` and `maxStalledCount` are configured.
    - Implemented Dead-Letter Queue (DLQ) behavior by preserving jobs in the failed set (`removeOnFail: false`) and explicitly logging when jobs fail completely.
    - Modified `FetcherAgent` to correctly throw errors on HTTP 403, 429, and 503 instead of manually requeueing, allowing Bull's exponential backoff retry mechanism to take effect.
    - Integrated 403 Forbidden responses into the proxy rotation and ban system to mitigate WAF blocks.
    - Added comprehensive tests for Dead Letter Queue retry flow and proxy rotation on 403/429 responses.
    - Resolved React accessibility (a11y) linting issues in `WorkerCard` and `WorkerDetailModal` components for the dashboard.

- Storage Optimizer & Object Storage Adapter:
    - Added `StorageOptimizer` utility to support Brotli and Gzip compression of raw HTML data.
    - Added `COMPRESSION_ALGO` environment variable configuration (defaults to `brotli`).
    - Implemented `ObjectStorageAdapter` interface for future S3 integration.
    - Created `S3ObjectStorageAdapter` stub to prepare for AWS S3 Storage implementation next time.
    - Updated `StorageService` to compress raw HTML data before storing in MongoDB as a fallback until S3 is fully integrated.
    - Added comprehensive unit tests for compression and storage retrieval.

- Fixed False Positive Deduplication Bug:
    - Removed `simhash-js` library which had a critical logic error causing it to return identical or highly similar 32-bit hashes for many different web pages.
    - Implemented a robust custom 64-bit SimHash algorithm in `DuplicateEliminator` utilizing `BigInt` and the `FNV-1a` hash.
    - Vastly reduced the probability of false-positive "Duplicate or mirrored content detected" events during crawling.
    - Improved unit tests for `DuplicateEliminator` to accurately test exact matches, near-duplicates, different generic texts, and max storage capacity.

- Fixed Dashboard Queue Pause/Stop Functionality:
    - Updated `Frontier` pause method to use `doNotWaitActive=true` to prevent blocking the UI.
    - Implemented a `crawler:stopped` state in Redis to ensure workers completely halt fetching when "Stop & Empty Queue" is triggered.
    - Added an early exit check in `FetcherAgent` for both `isPaused` and `isStopped` states so that active jobs gracefully abort or requeue themselves instead of continuing to fetch and queue new URLs.
    - Fixed UI state in `GlobalStatus.tsx` so users can resume the queue after it has been stopped.
    - Added comprehensive unit tests for `pause`, `stop`, `resume`, and `empty` in `tests/frontier.test.ts`.

- Dynamic Politeness & Egress Manager:
    - Implemented dynamic exponential backoff in `rate-limiter` to adjust crawl delays based on server responses (429/503).
    - Created `ProxyManager` with proxy rotation, failure tracking, and temporary banning.
    - Integrated proxy rotation and status code reporting directly into `FetcherAgent`.
    - Added graceful requeuing logic for rate-limited URLs to prevent data loss.
    - Added unit tests for proxy management and dynamic rate limiting.

Feb 21, 2026
Developer: Reynaldo 
- Advanced Processing & Scale Foundation:
    - Added `puppeteer` dependency for headless browser rendering.
    - Implemented `RendererAgent` to execute JavaScript and render dynamic Single Page Applications (SPAs).
    - Updated `FetcherAgent` with a heuristic to detect suspected SPAs and route them to the `RendererAgent`.
    - Added resource blocking (images, media, fonts, css) in `RendererAgent` to optimize rendering speed.
    - Implemented memory leak protection in `RendererAgent` by automatically restarting the browser context every 50 requests.
    - Updated `config.ts` to include `USE_RENDERER` environment variable.
    - Added `tests/renderer.test.ts` to verify SPA rendering and network idle waiting.
    - Updated orchestrator (`src/index.ts`) to gracefully initialize and close the `RendererAgent`.

-  Deduplicate Content:
    - Added `simhash-js` dependency for content fingerprinting.
    - Updated `DuplicateEliminator` to compute Simhash for extracted text and detect near-duplicates by calculating Hamming distance against recently stored content.
    - Updated `ParserAgent` to correctly extract clean body text, ignoring `script` and `style` tags, for accurate deduplication.
    - Integrated duplicate content checking within `FetcherAgent` to efficiently drop mirror sites.
    - Updated `config.ts` to include `SIMHASH_THRESHOLD` environment variable.
    - Added and updated tests (`tests/eliminator.test.ts`, `tests/parser.test.ts`) to verify duplicate detection and robust text extraction.

- Spider Trap and Domain Restriction Filter:
    - Implemented Spider Trap Protector in `ParserAgent` (URL depth limits & Path-repetition detection algorithm).
    - Implemented Domain Restriction Filter in `ParserAgent` to prevent escaping the original target domain.
    - Updated `tests/parser.test.ts` to verify domain restriction and spider trap handling.

    
- Distributed URL Frontier Enhancements:
    - Updated `Frontier` to implement domain-based hash routing, hashing the domain to assign jobs to specific partitions.
    - Updated `FetcherAgent` to configure itself based on designated partition IDs (`WORKER_PARTITION_IDS`) or fall back to listening to all partitions.
    - Added `QUEUE_PARTITIONS` and `WORKER_PARTITION_IDS` configuration variables to `config.ts`.
    - Added hash routing validation tests in `tests/frontier.test.ts`.

- Dashboard Integration:
    - Built the `crawler-dashboard` Vite React app and configured it to be served by an Express BFF server.
    - Updated `src/frontend/server/index.ts` to properly handle Express 5 `path-to-regexp` catch-all routing for SPA functionality.
    - Added `express` and `cors` to the root project dependencies for the BFF API.
    - Fixed incorrect `config` import paths in `control.ts`, `dataExplorer.ts`, `queueMetrics.ts`, and `errorLogs.ts` inside the `src/frontend/server/` directory.
    - Updated `src/index.ts` to expose the backend-for-frontend on port 4000 alongside the crawler's orchestrator layer.
    - Resolved Vite to BFF proxy `ECONNREFUSED` issues by migrating bindings from `localhost` to `127.0.0.1`.
    - Stripped out all dummy `MOCK` payloads and variables from the Express data providers (`queueMetrics`, `dataExplorer`, `workerHealth`, `errorLogs`) guaranteeing real-time system state mirroring instead of mock fallbacks.
    - Added a `QueueJobs` frontend component to the dashboard's `GlobalStatus` view to show live BullMQ jobs in a tabular format.
    - Wired up the Kill Switch (Pause, Stop) UI components in `GlobalStatus.tsx` to directly interact with the backend queue control endpoints.
    - Updated `GlobalStatus.tsx` to handle layout fixes and state management for queue commands.
    - Implemented and hooked up `ioredis` flush command functionality via a Confirm Modal in the UI.


- Fixed Dashboard Queue Pause/Stop Functionality:
    - Updated backend API endpoints (`/api/queue/pause`, `/api/queue/resume`, `/api/queue/stop`) in `src/frontend/server/routes/control.ts` to use correct `bull` methods (`pause(false)`, `resume(false)`) instead of invalid parameter signatures (`pause(true, false)`).

Bugs Found 
- Too Deep Fetching
    - Description: 
    When trying to crawl SRV, it scraped the index file after using the renderer, but after encountering youtube video links it then fetched from the youtube site.

    - Fixes: 
    Implemented Domain Restriction Filter in ParserAgent to prevent the crawler from escaping the original target domain.
    Refined Domain Restriction Filter to allow 1-hop embedded links (like youtube or tiktok) from the seed domain but restrict further out-of-bounds crawling by passing originalDomain through the Frontier Queue.
    
- Pause and Stop Queue and Clear Redis Queue Endpoints are not working
    - Description: 
    The logs show in the backend layer but it does not appear to affect the services 


    
Developer: Jan Dale 

Feb 20, 2026 
Developer: Reynaldo 
- Initialized MVP Development: 
    - Set up project structure with Bun and TypeScript.
    - Implemented `FetcherAgent` for core HTML fetching pipeline.
    - Integrated Redis (`bull`) as the URL Frontier queue.
    - Integrated MongoDB as the Storage Service for raw HTML and parsed metadata.
    - Implemented `ParserAgent` using Cheerio to extract titles and links.
    - Implemented `DuplicateEliminator` using a Bloom Filter for URL deduplication.
    - Added DNS Caching (`cacheable-lookup`) and Rate Limiting politeness controls.
    - Added `robots.txt` parsing to respect site crawling rules.
    - Configured ESLint/Biome for formatting and linting.
    - Setup initial test suites for agents and services.

