import Queue from "bull";
import { config } from "../config";

export interface CrawlJobData {
	url: string;
	depth: number;
	originalDomain?: string;
}

export class Frontier {
	private queue: Queue.Queue;

	constructor(queueName = "crawler-frontier") {
		this.queue = new Queue(queueName, config.redisUrl);
	}

	async addUrl(url: string, depth = 0, originalDomain?: string) {
		if (depth > config.maxDepth) {
			console.log(
				`Skipping ${url}, max depth reached (${depth} > ${config.maxDepth})`,
			);
			return null;
		}
		return this.queue.add(
			{ url, depth, originalDomain },
			{
				attempts: 3, // Retry up to 3 times
				backoff: {
					type: "exponential",
					delay: 2000, // 2s -> 4s -> 8s
				},
				removeOnComplete: true, // Clean up done jobs
				removeOnFail: false, // Leave failed jobs in DB acting as Dead-Letter Queue
			},
		);
	}

	getQueue() {
		return this.queue;
	}

	async close() {
		await this.queue.close();
	}
}
