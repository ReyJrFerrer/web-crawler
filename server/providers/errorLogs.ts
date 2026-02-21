import Queue from "bull";
import Redis from "ioredis";
import { config } from "../../src/config";

export interface ErrorLogEntry {
	url: string;
	error: string;
	attempts: number;
	ts?: string;
}

// Mock is ONLY used when Redis itself is unreachable (true offline mode)
const MOCK: ErrorLogEntry[] = [
	{
		url: "https://badsite.com",
		error: "Timeout exceeded (10000ms)",
		attempts: 3,
	},
	{
		url: "https://secure.com",
		error: "403 Forbidden - WAF Block",
		attempts: 1,
	},
	{
		url: "https://hugepdf.com/file.pdf",
		error: "Aborted: Invalid Content-Type",
		attempts: 1,
	},
];

const ERROR_LIST_KEY = "crawler:errors";

let bullQueue: Queue.Queue | null = null;
let redisClient: Redis | null = null;

function getBullQueue(): Queue.Queue {
	if (!bullQueue) {
		bullQueue = new Queue("crawler-frontier", config.redisUrl);
	}
	return bullQueue;
}

function getRedis(): Redis {
	if (!redisClient) {
		redisClient = new Redis(config.redisUrl, { lazyConnect: false });
	}
	return redisClient;
}

export async function getErrorLogs(limit = 50): Promise<ErrorLogEntry[]> {
	try {
		const redis = getRedis();
		const q = getBullQueue();

		// Fetch both sources in parallel
		const [rawEntries, failedJobs] = await Promise.all([
			// Source 1: transient errors pushed by fetcher.ts immediately on failure
			redis.lrange(ERROR_LIST_KEY, 0, limit - 1),
			// Source 2: Bull dead-letter queue (jobs that exhausted all 3 retries)
			q.getFailed(0, limit - 1),
		]);

		// Parse the Redis list entries
		const transientErrors: ErrorLogEntry[] = rawEntries
			.map((raw): ErrorLogEntry | null => {
				try {
					const parsed = JSON.parse(raw) as {
						url: string;
						error: string;
						attempts: number;
						ts?: string;
					};
					return {
						url: parsed.url ?? "unknown",
						error: parsed.error ?? "Unknown error",
						attempts: parsed.attempts ?? 1,
						ts: parsed.ts,
					};
				} catch {
					return null;
				}
			})
			.filter((e): e is ErrorLogEntry => e !== null);

		// Parse the Bull failed jobs
		const deadLetterErrors: ErrorLogEntry[] = failedJobs.map((job) => ({
			url: (job.data as { url: string }).url ?? "unknown",
			error:
				job.failedReason ??
				job.stacktrace?.[0]?.split("\n")[0] ??
				"Unknown error",
			attempts: job.attemptsMade,
			ts: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
		}));

		// Merge: dead-letter entries first (most severe), then transient errors.
		// Deduplicate by URL — keep the first (most severe) occurrence per URL.
		const seen = new Set<string>();
		const merged: ErrorLogEntry[] = [];

		for (const entry of [...deadLetterErrors, ...transientErrors]) {
			if (!seen.has(entry.url)) {
				seen.add(entry.url);
				merged.push(entry);
			}
			if (merged.length >= limit) break;
		}

		// Return empty array if truly nothing has errored — never show mock when online
		return merged;
	} catch {
		// Only reach here if Redis and Bull are both unreachable
		return MOCK;
	}
}
