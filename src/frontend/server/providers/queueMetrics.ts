import Queue from "bull";
import Redis from "ioredis";
import { config } from "../../../config";

export interface QueueCounts {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
}

export interface TopDomain {
	domain: string;
	count: number;
}

export interface QueueMetrics {
	status: "connected" | "offline";
	counts: QueueCounts;
	currentRate: string;
	topDomainsWaiting: TopDomain[];
}

const OFFLINE_METRICS: QueueMetrics = {
	status: "offline",
	counts: {
		waiting: 0,
		active: 0,
		completed: 0,
		failed: 0,
		delayed: 0,
	},
	currentRate: "0.0 pages/sec",
	topDomainsWaiting: [],
};

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

let queue: Queue.Queue | null = null;
let redisClient: Redis | null = null;
let listenerAttached = false;

// In-process completed counter — seeded from Redis on first use, then kept
// up-to-date via the Bull global:completed event so we never rely on
// getJobCounts().completed (which is always 0 because removeOnComplete: true).
let completedCount = 0;
let _completedLoaded = false;

// Crawl-rate tracking
let lastCompletedSnapshot = 0;
let lastPollTime = Date.now();

const COMPLETED_KEY = "crawler:stats:completed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRedis(): Redis {
	if (!redisClient) {
		redisClient = new Redis(config.redisUrl, { lazyConnect: false });
	}
	return redisClient;
}

function getQueue(): Queue.Queue {
	if (!queue) {
		queue = new Queue("crawler-frontier", config.redisUrl);
	}
	return queue;
}

/**
 * Seed completedCount from Redis on startup so the counter survives BFF
 * restarts. Then attach a one-time global:completed listener that increments
 * both the in-memory counter and the Redis key every time a job finishes.
 */
async function ensureCompletedListener(): Promise<void> {
	if (listenerAttached) return;
	listenerAttached = true;

	const redis = getRedis();

	// Seed from Redis so we don't start from 0 after a BFF restart
	try {
		const stored = await redis.get(COMPLETED_KEY);
		completedCount = stored ? parseInt(stored, 10) : 0;
		_completedLoaded = true;
	} catch {
		_completedLoaded = true; // proceed with 0
	}

	const q = getQueue();

	// Bull emits 'global:completed' whenever any worker finishes a job
	q.on("global:completed", () => {
		completedCount += 1;
		// Fire-and-forget Redis increment — don't await to keep the handler sync
		redis.incr(COMPLETED_KEY).catch(() => {
			/* ignore */
		});
	});
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

export async function getQueueMetrics(): Promise<QueueMetrics> {
	try {
		await ensureCompletedListener();

		const q = getQueue();
		const counts = await q.getJobCounts();

		// Crawl rate: delta of our accurate completedCount between polls
		const now = Date.now();
		const elapsedSec = (now - lastPollTime) / 1000;
		const delta = completedCount - lastCompletedSnapshot;
		const rate =
			elapsedSec > 0 && delta >= 0 ? (delta / elapsedSec).toFixed(1) : "0.0";

		lastCompletedSnapshot = completedCount;
		lastPollTime = now;

		// Sample waiting+active jobs to build a domain breakdown
		const [activeJobs, waitingJobs] = await Promise.all([
			q.getActive(),
			q.getWaiting(0, 99),
		]);

		const domainMap = new Map<string, number>();
		for (const job of [...activeJobs, ...waitingJobs]) {
			try {
				const url = new URL((job.data as { url: string }).url);
				const d = url.hostname;
				domainMap.set(d, (domainMap.get(d) ?? 0) + 1);
			} catch {
				// skip malformed URLs
			}
		}

		const topDomainsWaiting: TopDomain[] = [...domainMap.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([domain, count]) => ({ domain, count }));

		return {
			status: "connected",
			counts: {
				waiting: counts.waiting,
				active: counts.active,
				// Use our event-driven counter — getJobCounts().completed is always 0
				// because frontier.ts sets removeOnComplete: true
				completed: completedCount,
				failed: counts.failed,
				delayed: counts.delayed,
			},
			currentRate: `${rate} pages/sec`,
			topDomainsWaiting,
		};
	} catch {
		return OFFLINE_METRICS;
	}
}

export function getQueueInstance(): Queue.Queue | null {
	return queue;
}
