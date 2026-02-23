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
	compressionAlgo: (process.env.COMPRESSION_ALGO || "brotli") as
		| "brotli"
		| "gzip"
		| "none",
	proxyListUrl: process.env.PROXY_LIST_URL || "",
};
