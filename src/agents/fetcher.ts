import axios from "axios";
import { config } from "../config";
import type { Frontier } from "../services/frontier";
import type { StorageService } from "../services/storage";
import { httpAgent, httpsAgent } from "../utils/dns-cache";
import { enforcePerDomainRateLimit } from "../utils/rate-limiter";
import { isAllowedByRobots } from "../utils/robots";
import type { DuplicateEliminator } from "./eliminator";
import type { ParserAgent } from "./parser";
import type { RendererAgent } from "./renderer";

export class FetcherAgent {
	private frontier: Frontier;
	private storage: StorageService;
	private parser: ParserAgent;
	private eliminator: DuplicateEliminator;
	private renderer: RendererAgent | null;

	constructor(
		frontier: Frontier,
		storage: StorageService,
		parser: ParserAgent,
		eliminator: DuplicateEliminator,
		renderer: RendererAgent | null = null,
	) {
		this.frontier = frontier;
		this.storage = storage;
		this.parser = parser;
		this.eliminator = eliminator;
		this.renderer = renderer;
	}

	private isSuspectedSPA(html: string, linksCount: number): boolean {
		if (!config.useRenderer || !this.renderer) return false;

		const hasScriptTag = /<script\b[^>]*>/i.test(html);
		const hasCommonSPARoot = /id=["'](?:root|app)["']/i.test(html);

		if (linksCount <= 2 && hasScriptTag && hasCommonSPARoot) {
			return true;
		}

		return false;
	}

	async fetchAndProcess(
		url: string,
		depth: number,
		originalDomain?: string,
	): Promise<boolean> {
		try {
			if (await this.frontier.isStopped()) {
				console.log(`[Fetcher] Queue is stopped. Aborting fetch for ${url}`);
				return true; // Complete the job so it leaves the active list, do not requeue
			}
			if (await this.frontier.isPaused()) {
				console.log(
					`[Fetcher] Queue is paused. Re-queuing ${url} and aborting active fetch.`,
				);
				await this.frontier.addUrl(url, depth, originalDomain);
				return true; // Complete the current active job since we re-queued it
			}

			if (depth > config.maxDepth) {
				console.log(`[Fetcher] Max depth reached for ${url}`);
				return true;
			}

			// 1. Politeness Manager: Check robots.txt
			const allowed = await isAllowedByRobots(url);
			if (!allowed) {
				console.log(`[Fetcher] Skipping ${url} (Disallowed by robots.txt)`);
				return true; // Return true so it completes the job instead of retrying
			}

			// 2. Per-domain rate limiting (Day 3 enhancement)
			await enforcePerDomainRateLimit(url, config.crawlDelayMs);
			console.log(`[Fetcher] Fetching URL: ${url} (Depth: ${depth})`);

			// 3. Download HTML (using cacheable-lookup DNS Cache)
			const response = await axios.get(url, {
				headers: { "User-Agent": config.userAgent },
				timeout: 10000,
				httpAgent,
				httpsAgent,
			});

			if (response.status !== 200 || !response.data) {
				console.error(
					`[Fetcher] Failed to fetch ${url}, status: ${response.status}`,
				);
				return false;
			}

			let html =
				typeof response.data === "string"
					? response.data
					: JSON.stringify(response.data);

			// Parse HTML
			let { title, links, text } = this.parser.parse(url, html, originalDomain);

			// Detect SPA
			if (this.isSuspectedSPA(html, links.length)) {
				console.log(
					`[Fetcher] Suspected SPA detected for ${url}. Handing over to Renderer Agent.`,
				);
				try {
					const renderedHtml = await this.renderer?.render(url);
					if (renderedHtml) {
						html = renderedHtml;
						// Re-parse with the rendered HTML
						const parsed = this.parser.parse(url, html, originalDomain);
						title = parsed.title;
						links = parsed.links;
						text = parsed.text;
					}
				} catch (renderError) {
					console.error(
						`[Fetcher] Renderer failed for ${url}, falling back to raw HTML.`,
						renderError,
					);
				}
			}

			// Content Duplicate Eliminator
			if (this.eliminator.isDuplicateContent(text)) {
				console.log(
					`[Fetcher] Duplicate or mirrored content detected for ${url}. Dropping.`,
				);
				return true;
			}

			// Save raw HTML
			await this.storage.saveRawHtml(url, html);
			console.log(
				`[Fetcher] Stored raw HTML for ${url} (Optimized with ${config.compressionAlgo || "brotli"})`,
			);

			// Save parsed metadata
			await this.storage.saveParsedData(url, { title, links });
			console.log(
				`[Fetcher] Parsed metadata for ${url} (Found ${links.length} links)`,
			);

			// Queue new links
			if (depth < config.maxDepth && !(await this.frontier.isStopped())) {
				let addedCount = 0;
				let defaultDomain = originalDomain;
				if (!defaultDomain) {
					try {
						defaultDomain = new URL(url).hostname;
					} catch (_e) {
						// ignore
					}
				}
				for (const link of links) {
					if (this.eliminator.isNew(link)) {
						await this.frontier.addUrl(link, depth + 1, defaultDomain);
						addedCount++;
					}
				}
				console.log(`[Fetcher] Queued ${addedCount} new URLs from ${url}`);
			}

			return true;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`[Fetcher] Error fetching ${url}:`, errorMessage);
			return false;
		}
	}

	startListening() {
		const queue = this.frontier.getQueue();

		queue.on("paused", () => {
			console.log("[Fetcher] Queue has been paused. Workers are suspended.");
		});

		queue.on("resumed", () => {
			console.log("[Fetcher] Queue has been resumed. Workers are active.");
		});

		queue.on("cleaned", (jobs, type) => {
			console.log(
				`[Fetcher] Queue has been cleaned. Removed ${jobs.length} jobs of type ${type}.`,
			);
		});

		queue.on("error", (error) => {
			if (error.message?.includes("Missing key for job")) {
				// Suppress harmless "Missing key for job" errors.
				// These are expected if the user clears the Redis queue or hits "Stop"
				// from the dashboard while fetchers are still actively processing a job.
				return;
			}
			console.error("[Fetcher] Queue encountered an error:", error);
		});

		let partitionsToProcess: number[] = [];
		if (config.workerPartitionIds) {
			partitionsToProcess = config.workerPartitionIds
				.split(",")
				.map((id) => parseInt(id.trim(), 10));
		} else {
			for (let i = 0; i < config.queuePartitions; i++) {
				partitionsToProcess.push(i);
			}
		}

		for (const partitionId of partitionsToProcess) {
			const jobName = `partition-${partitionId}`;
			queue.process(jobName, config.fetcherConcurrency, async (job) => {
				const { url, depth, originalDomain } = job.data;
				const success = await this.fetchAndProcess(url, depth, originalDomain);
				if (!success) {
					throw new Error(`Failed to process ${url}`);
				}
				return success;
			});
		}

		console.log(
			`[Fetcher] Agent started listening to partitions [${partitionsToProcess.join(",")}] with concurrency ${config.fetcherConcurrency}`,
		);
	}
}
