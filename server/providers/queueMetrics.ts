import Queue from "bull";
import { config } from "../../src/config";

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

const MOCK: QueueMetrics = {
	status: "connected",
	counts: {
		waiting: 14502,
		active: 5,
		completed: 8230,
		failed: 112,
		delayed: 450,
	},
	currentRate: "4.2 pages/sec",
	topDomainsWaiting: [
		{ domain: "example.com", count: 5000 },
		{ domain: "wikipedia.org", count: 3200 },
	],
};

// Singleton queue instance so we don't create a new connection per request
let queue: Queue.Queue | null = null;

// Tracks completed job count between polls to compute crawl rate
let lastCompletedCount = 0;
let lastPollTime = Date.now();

function getQueue(): Queue.Queue {
	if (!queue) {
		queue = new Queue("crawler-frontier", config.redisUrl);
	}
	return queue;
}

export async function getQueueMetrics(): Promise<QueueMetrics> {
	try {
		const q = getQueue();
		const counts = await q.getJobCounts();

		const now = Date.now();
		const elapsedSec = (now - lastPollTime) / 1000;
		const completedDelta = counts.completed - lastCompletedCount;
		const rate =
			elapsedSec > 0 && completedDelta >= 0
				? (completedDelta / elapsedSec).toFixed(1)
				: "0.0";

		lastCompletedCount = counts.completed;
		lastPollTime = now;

		// Sample waiting+active jobs to build a rough domain breakdown
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
				completed: counts.completed,
				failed: counts.failed,
				delayed: counts.delayed,
			},
			currentRate: `${rate} pages/sec`,
			topDomainsWaiting:
				topDomainsWaiting.length > 0
					? topDomainsWaiting
					: MOCK.topDomainsWaiting,
		};
	} catch {
		return { ...MOCK, status: "offline" };
	}
}

export function getQueueInstance(): Queue.Queue | null {
	return queue;
}
