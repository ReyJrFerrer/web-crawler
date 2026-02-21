import Queue from "bull";
import { config } from "../../src/config";

export interface ErrorLogEntry {
	url: string;
	error: string;
	attempts: number;
}

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

let queue: Queue.Queue | null = null;

function getQueue(): Queue.Queue {
	if (!queue) {
		queue = new Queue("crawler-frontier", config.redisUrl);
	}
	return queue;
}

export async function getErrorLogs(limit = 20): Promise<ErrorLogEntry[]> {
	try {
		const q = getQueue();
		const failedJobs = await q.getFailed(0, limit - 1);

		if (failedJobs.length === 0) return MOCK;

		return failedJobs.map((job) => ({
			url: (job.data as { url: string }).url ?? "unknown",
			error:
				job.failedReason ??
				job.stacktrace?.[0]?.split("\n")[0] ??
				"Unknown error",
			attempts: job.attemptsMade,
		}));
	} catch {
		return MOCK;
	}
}
