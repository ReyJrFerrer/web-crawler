import axios from "axios";
import { config } from "../config";
import type { Frontier } from "../services/frontier";
import type { StorageService } from "../services/storage";
import { httpAgent, httpsAgent } from "../utils/dns-cache";
import { enforcePerDomainRateLimit } from "../utils/rate-limiter";
import { isAllowedByRobots } from "../utils/robots";
import type { DuplicateEliminator } from "./eliminator";
import type { ParserAgent } from "./parser";

export class FetcherAgent {
	private frontier: Frontier;
	private storage: StorageService;
	private parser: ParserAgent;
	private eliminator: DuplicateEliminator;

	constructor(
		frontier: Frontier,
		storage: StorageService,
		parser: ParserAgent,
		eliminator: DuplicateEliminator,
	) {
		this.frontier = frontier;
		this.storage = storage;
		this.parser = parser;
		this.eliminator = eliminator;
	}

	async fetchAndProcess(url: string, depth: number): Promise<boolean> {
		try {
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

			const html =
				typeof response.data === "string"
					? response.data
					: JSON.stringify(response.data);

			// Save raw HTML
			await this.storage.saveRawHtml(url, html);
			console.log(`[Fetcher] Stored raw HTML for ${url}`);

			// Parse HTML
			const { title, links } = this.parser.parse(url, html);

			// Save parsed metadata
			await this.storage.saveParsedData(url, { title, links });
			console.log(
				`[Fetcher] Parsed metadata for ${url} (Found ${links.length} links)`,
			);

			// Queue new links
			if (depth < config.maxDepth) {
				let addedCount = 0;
				for (const link of links) {
					if (this.eliminator.isNew(link)) {
						await this.frontier.addUrl(link, depth + 1);
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
		queue.process(config.fetcherConcurrency, async (job) => {
			const { url, depth } = job.data;
			const success = await this.fetchAndProcess(url, depth);
			if (!success) {
				throw new Error(`Failed to process ${url}`);
			}
			return success;
		});

		console.log(
			`[Fetcher] Agent started listening with concurrency ${config.fetcherConcurrency}`,
		);
	}
}
