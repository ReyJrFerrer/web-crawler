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

	private hashDomain(domain: string): number {
		let hash = 0;
		for (let i = 0; i < domain.length; i++) {
			hash = (hash << 5) - hash + domain.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}
		return Math.abs(hash);
	}

	async addUrl(url: string, depth = 0, originalDomain?: string) {
		if (depth > config.maxDepth) {
			console.log(
				`Skipping ${url}, max depth reached (${depth} > ${config.maxDepth})`,
			);
			return null;
		}

		let domain = originalDomain;
		if (!domain) {
			try {
				domain = new URL(url).hostname;
			} catch (_e) {
				domain = "unknown";
			}
		}

		const partitionId = this.hashDomain(domain) % config.queuePartitions;
		const jobName = `partition-${partitionId}`;

		return this.queue.add(
			jobName,
			{ url, depth, originalDomain: domain },
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
