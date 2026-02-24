# Project Design Report (PDR): Scalable Web Crawler System

## 1. Introduction

### 1.1 Purpose

The purpose of this document is to outline the architectural design and system requirements for a highly scalable, distributed web crawler. Similar to search engine bots (e.g., Googlebot), this system is designed to traverse the World Wide Web, download web pages, extract meaningful content, and discover new URLs for continuous indexing.

### 1.2 Scope

This project covers the data ingestion and parsing phase of a search engine or large-scale data analytics platform. It does not cover the user-facing search interface or the ranking algorithms, but rather focuses strictly on the robust, polite, and scalable gathering of web data.

---

## 2. System Architecture

To achieve massive scalability, the crawler transitions from a single-machine script to a distributed microservices architecture.

### 2.1 Core Components

1. **Seed Injector**: The entry point that populates the initial set of URLs to be crawled.

2. **URL Frontier (Distributed Message Queue)**: Replaces the in-memory array. Manages the queue of URLs to be fetched, prioritizing them based on update frequency, domain authority, and crawl policies.

3. **DNS Resolver / Cache**: A highly optimized DNS resolution service to prevent DNS lookups from becoming a bottleneck.

4. **Fetcher (Downloader) Fleet**: A horizontally scaled cluster of worker nodes that read URLs from the Frontier, download the raw HTML/content, and enforce Politeness Policies (rate limiting per domain).

5. **Renderer (Optional)**: A cluster of headless browsers (e.g., Puppeteer/Playwright) designed to execute JavaScript and render dynamic Single Page Applications (SPAs) before parsing.

6. **Parser & Extractor**: Processes the downloaded raw content to extract metadata, text, and outbound/inbound links.

7. **Duplicate Eliminator**: Uses algorithms (like Bloom Filters for URLs and Simhash for content) to drop duplicate URLs and near-duplicate content pages.

8. **Storage Subsystem**: The persistence layer for raw HTML, extracted text, and the document index.

---

## 3. Data Flow

1. The URL Frontier pops a URL and sends it to an available Fetcher.

2. The Fetcher checks the DNS Cache for the IP address. If missing, it resolves and caches it.

3. The Fetcher checks the domain's robots.txt (cached locally) to ensure permission.

4. The Fetcher downloads the document.

5. The document is sent to the Storage Subsystem (raw data lake) and the Parser.

6. The Parser extracts text content and sends it to the Indexer (e.g., Elasticsearch).

7. The Parser extracts all URLs and passes them to the Duplicate Eliminator.

8. The Duplicate Eliminator checks a Bloom Filter. If the URL is new, it is pushed back into the URL Frontier.

---

## 4. Scalability & Performance Strategies

### 4.1 Distributed URL Frontier

A standard database will fail under the write-load of billions of URLs. The URL Frontier must be implemented using distributed stream processing or fast in-memory stores:

- **Technology**: Apache Kafka, RabbitMQ, or Redis Clusters.

- **Partitioning**: URLs are partitioned by domain (hash routing). This ensures that all URLs for example.com go to the same Fetcher node, making it easier to enforce domain-specific rate limits and politeness.

### 4.2 Horizontal Scaling of Fetchers

The system is heavily I/O bound (waiting on network requests).

- **Implementation**: Deploy Fetchers as containerized microservices (Docker/Kubernetes). As the queue grows, the orchestration tool can automatically spin up more Fetcher pods.

- **Asynchronous I/O**: Fetchers must use non-blocking, asynchronous HTTP clients (e.g., aiohttp in Python or Node.js) to handle thousands of concurrent connections per node.

### 4.3 Deduplication at Scale

Checking if a URL has been visited against a standard database of billions of rows is too slow.

- **URL Deduplication**: Utilize a Bloom Filter—a highly space-efficient probabilistic data structure. It can quickly tell us if a URL is "definitely not" in the set, saving a database lookup.

- **Content Deduplication**: Utilize MinHash or Simhash to create fingerprints of the page content. This prevents storing and indexing mirror sites or pages with only minor timestamp differences.

### 4.4 Distributed Storage

- **Raw HTML Storage**: Object storage systems like AWS S3 or distributed file systems like Hadoop Distributed File System (HDFS).

- **Parsed Data/Index**: NoSQL databases (Cassandra, MongoDB) for metadata, and an Inverted Index cluster (Elasticsearch, Apache Solr) for the actual search index.

---

## 5. Non-Functional Requirements

### 5.1 Politeness (Crucial)

A scalable crawler can easily act as a Distributed Denial of Service (DDoS) attack if not careful.

- **Robots.txt Adherence**: Strict, heavily cached compliance.

- **Crawl Delay**: Implement dynamic rate limiting per domain. If a server's response time degrades, the crawler must automatically back off.

- **User-Agent Identification**: Clearly identify the bot and provide a URL for webmasters to learn about the crawler and opt-out.

### 5.2 Fault Tolerance

- **Crash Recovery**: If a Fetcher dies mid-crawl, the unacknowledged URLs must be returned to the URL Frontier (e.g., using Kafka consumer groups or message un-ack mechanisms).

- **Dead-letter Queues**: URLs that repeatedly timeout or fail should be moved to a dead-letter queue for later analysis, preventing them from clogging the main pipeline.

### 5.3 Extensibility

- The parsing layer must be pluggable. It should be easy to add new modules (e.g., an image extraction module, an NLP entity recognition module) without rewriting the core crawl loop.

---

## 6. Known Challenges & Mitigations

| Challenge | Description | Mitigation Strategy |
|-----------|-------------|---------------------|
| **Spider Traps** | Infinite loops generated dynamically by servers (e.g., calendar/2026/01/01, calendar/2026/01/02...). | Impose strict URL depth limits. Implement path-repetition detection in the URL parser. |
| **Dynamic SPAs** | React/Angular sites that serve blank HTML until JS executes. | Route URLs lacking standard HTML content to a specialized pool of headless browser renderers (Puppeteer). |
| **Data Gravity** | The sheer volume of raw HTML will quickly exhaust storage budgets. | Compress raw HTML (GZIP/Brotli) before storage. Define strict retention policies (e.g., keep raw HTML for 30 days, keep indexed text indefinitely). |
| **IP Blocking** | Web application firewalls (WAFs) blocking the crawler's IP. | Maintain a diverse pool of egress IP addresses or proxies. Ensure the politeness policy is strictly adhered to so the bot is not perceived as a threat. |

---

**End of Document**