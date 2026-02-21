import axios from "axios";
import Redis from "ioredis";
import { config } from "../config";
import type { Frontier } from "../services/frontier";
import type { StorageService } from "../services/storage";
import { httpAgent, httpsAgent } from "../utils/dns-cache";
import { enforcePerDomainRateLimit } from "../utils/rate-limiter";
import { isAllowedByRobots } from "../utils/robots";
import type { DuplicateEliminator } from "./eliminator";
import type { ParserAgent } from "./parser";
import type { RendererAgent } from "./renderer";

// Shared Redis client for pushing error telemetry — lazy singleton
let errorRedis: Redis | null = null;
function getErrorRedis(): Redis {
	if (!errorRedis) {
		errorRedis = new Redis(config.redisUrl, { lazyConnect: false });
	}
	return errorRedis;
}

const ERROR_LIST_KEY = "crawler:errors";
const ERROR_LIST_MAX = 100;

/**
 * Fire-and-forget: push a structured error entry to the Redis list so the
 * dashboard can read it immediately without waiting for Bull retries to exhaust.
 */
function pushErrorToRedis(url: string, error: string, attempts: number): void {
	const entry = JSON.stringify({
		url,
		error,
		attempts,
		ts: new Date().toISOString(),
	});
	const redis = getErrorRedis();
	// LPUSH then LTRIM to keep the list capped at ERROR_LIST_MAX entries
	redis
		.lpush(ERROR_LIST_KEY, entry)
		.then(() => redis.ltrim(ERROR_LIST_KEY, 0, ERROR_LIST_MAX - 1))
		.catch(() => {
			/* ignore — telemetry must never crash the crawler */
		});
}

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
		attempt = 1,
	): Promise<boolean> {
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
				const msg = `Non-200 response: ${response.status}`;
				console.error(
					`[Fetcher] Failed to fetch ${url}, status: ${response.status}`,
				);
				pushErrorToRedis(url, msg, attempt);
				return false;
			}

			let html =
				typeof response.data === "string"
					? response.data
					: JSON.stringify(response.data);

			// Parse HTML
			let { title, links } = this.parser.parse(url, html);

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
						const parsed = this.parser.parse(url, html);
						title = parsed.title;
						links = parsed.links;
					}
				} catch (renderError) {
					console.error(
						`[Fetcher] Renderer failed for ${url}, falling back to raw HTML.`,
						renderError,
					);
				}
			}

			// Save raw HTML
			await this.storage.saveRawHtml(url, html);
			console.log(`[Fetcher] Stored raw HTML for ${url}`);

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
			pushErrorToRedis(url, errorMessage, attempt);
			return false;
		}
	}

	startListening() {
		const queue = this.frontier.getQueue();
		queue.process(config.fetcherConcurrency, async (job) => {
			const { url, depth } = job.data;
			const success = await this.fetchAndProcess(
				url,
				depth,
				job.attemptsMade + 1,
			);
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
