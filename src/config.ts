export const config = {
	redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
	mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/crawler",
	fetcherConcurrency: parseInt(process.env.FETCHER_CONCURRENCY || "10", 10),
	crawlDelayMs: parseInt(process.env.CRAWL_DELAY_MS || "2000", 10),
	maxDepth: parseInt(process.env.MAX_DEPTH || "3", 10),
	userAgent:
		process.env.USER_AGENT || "MyCrawler/1.0 (+http://example.com/bot)",
};
