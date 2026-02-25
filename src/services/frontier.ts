import { EventEmitter } from "node:events";
import Queue from "bull";
import { Redis } from "ioredis";
import { config } from "../config";

export interface CrawlJobData {
	url: string;
	depth: number;
	originalDomain?: string;
}

export class Frontier extends EventEmitter {
	private queue: Queue.Queue;
	private subClient: Redis | null = null;
	private pubClient: Redis | null = null;
	private isSubscribed = false;

	constructor(queueName = "crawler-frontier") {
		super();
		this.queue = new Queue(queueName, config.redisUrl, {
			settings: {
				lockDuration: 120000, // 2 minutes (prevents SPA rendering timeouts from stalling jobs)
				maxStalledCount: 2,
			},
		});
	}

	async initializeSubscribers() {
		if (this.isSubscribed) return;
		this.isSubscribed = true;

		this.subClient = new Redis(config.redisUrl);
		this.pubClient = new Redis(config.redisUrl);

		this.subClient.on("message", (channel, message) => {
			if (channel === "crawler:control") {
				const data = JSON.parse(message);
				this.emit("control", data);
			}
		});

		await this.subClient.subscribe("crawler:control");
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
				attempts: 3,
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

	async pause(isLocal = false) {
		console.log(`[Frontier] Pausing queue (local: ${isLocal})...`);
		await this.queue.pause(isLocal, true);
		if (!this.pubClient) this.pubClient = new Redis(config.redisUrl);
		await this.pubClient.publish(
			"crawler:control",
			JSON.stringify({ action: "pause" }),
		);
	}

	async resume(isLocal = false) {
		console.log(`[Frontier] Resuming queue (local: ${isLocal})...`);
		// Use the underlying Redis client to clear the stopped flag
		await this.queue.client.del("crawler:stopped");
		await this.queue.resume(isLocal);
		if (!this.pubClient) this.pubClient = new Redis(config.redisUrl);
		await this.pubClient.publish(
			"crawler:control",
			JSON.stringify({ action: "resume" }),
		);
	}

	async empty() {
		console.log(
			"[Frontier] Emptying queue (removing waiting/delayed/paused jobs)...",
		);
		await this.queue.empty();
		if (!this.pubClient) this.pubClient = new Redis(config.redisUrl);
		await this.pubClient.publish(
			"crawler:control",
			JSON.stringify({ action: "empty" }),
		);
	}

	async isPaused(isLocal = false) {
		return this.queue.isPaused(isLocal);
	}

	async isStopped() {
		// Use the underlying Redis client to check the stopped flag
		const val = await this.queue.client.get("crawler:stopped");
		return val === "true";
	}

	async stop() {
		console.log("[Frontier] Stopping and emptying queue...");
		await this.queue.client.set("crawler:stopped", "true");
		await this.pause(false);
		await this.empty();
		if (!this.pubClient) this.pubClient = new Redis(config.redisUrl);
		await this.pubClient.publish(
			"crawler:control",
			JSON.stringify({ action: "stop" }),
		);
	}

	async close() {
		if (this.subClient) {
			this.subClient.disconnect();
		}
		if (this.pubClient) {
			this.pubClient.disconnect();
		}
		await this.queue.close();
	}
}
