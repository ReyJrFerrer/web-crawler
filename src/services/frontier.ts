import Queue from "bull";
import { config } from "../config";

export interface CrawlJobData {
	url: string;
	depth: number;
}

export class Frontier {
	private queue: Queue.Queue;

	constructor(queueName = "crawler-frontier") {
		this.queue = new Queue(queueName, config.redisUrl);
	}

	async addUrl(url: string, depth = 0) {
		if (depth > config.maxDepth) {
			console.log(
				`Skipping ${url}, max depth reached (${depth} > ${config.maxDepth})`,
			);
			return null;
		}
		return this.queue.add({ url, depth });
	}

	getQueue() {
		return this.queue;
	}

	async close() {
		await this.queue.close();
	}
}
