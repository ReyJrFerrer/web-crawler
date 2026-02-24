import * as os from "node:os";

export const config = {
	redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
	mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/crawler",
	fetcherConcurrency: parseInt(process.env.FETCHER_CONCURRENCY || "10", 10),
	crawlDelayMs: parseInt(process.env.CRAWL_DELAY_MS || "2000", 10),
	maxDepth: parseInt(process.env.MAX_DEPTH || "5", 10),
	domainFilter:
		process.env.DOMAIN_FILTER === "true" || process.env.DOMAIN_FILTER === "1",
	userAgent:
		process.env.USER_AGENT || "MyCrawler/2.0 (+http://example.com/bot)",
	useRenderer:
		process.env.USE_RENDERER === "true" || process.env.USE_RENDERER === "1",
	simhashThreshold: parseInt(process.env.SIMHASH_THRESHOLD || "3", 10),
	queuePartitions: parseInt(process.env.QUEUE_PARTITIONS || "10", 10),
	workerPartitionIds: process.env.WORKER_PARTITION_IDS || "",
	role: (process.env.ROLE || "orchestrator") as "orchestrator" | "fetcher",
	podName: process.env.POD_NAME || os.hostname(),
	compressionAlgo: (process.env.COMPRESSION_ALGO || "brotli") as
		| "brotli"
		| "gzip"
		| "none",
	proxyListUrl: process.env.PROXY_LIST_URL || "",

	// Object Storage Config (DigitalOcean Spaces / S3)
	s3BucketName: process.env.S3_BUCKET_NAME || "crawler-raw-html",
	s3Region: process.env.S3_REGION || "nyc3",
	s3Endpoint: process.env.S3_ENDPOINT || "",
	s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
	s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
	s3RetentionDays: parseInt(process.env.S3_RETENTION_DAYS || "30", 10),

	// Indexer / Extensibility Layer Config
	elasticsearchNode: process.env.ELASTICSEARCH_NODE || "",
	elasticsearchIndex: process.env.ELASTICSEARCH_INDEX || "crawler-data",
	elasticsearchApiKey: process.env.ELASTICSEARCH_API_KEY || "",
};
