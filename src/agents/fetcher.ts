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
			let { title, links } = this.parser.parse(url, html, originalDomain);

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
		queue.process(config.fetcherConcurrency, async (job) => {
			const { url, depth, originalDomain } = job.data;
			const success = await this.fetchAndProcess(url, depth, originalDomain);
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
