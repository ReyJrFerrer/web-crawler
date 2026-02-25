import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { config } from "../config";
import type { Frontier } from "../services/frontier";
import type { StorageService } from "../services/storage";
import { httpAgent, httpsAgent } from "../utils/dns-cache";
import { proxyManager } from "../utils/proxy-manager";
import {
	enforcePerDomainRateLimit,
	updateDynamicDelay,
} from "../utils/rate-limiter";
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
		abortSignal?: AbortSignal,
	): Promise<boolean | { aborted: true }> {
		try {
			if (abortSignal?.aborted) return { aborted: true };

			if (await this.frontier.isStopped()) {
				console.log(`[Fetcher] Queue is stopped. Aborting fetch for ${url}`);
				return { aborted: true }; // Complete the job so it leaves the active list, do not requeue
			}
			if (await this.frontier.isPaused()) {
				console.log(
					`[Fetcher] Queue is paused. Re-queuing ${url} and aborting active fetch.`,
				);
				await this.frontier.addUrl(url, depth, originalDomain);
				return { aborted: true }; // Complete the current active job since we re-queued it
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
			await enforcePerDomainRateLimit(url, config.crawlDelayMs, abortSignal);

			if (abortSignal?.aborted) return { aborted: true };

			console.log(`[Fetcher] Fetching URL: ${url} (Depth: ${depth})`);

			// 3. Download Data
			const proxyConfig = await proxyManager.getProxy();
			const axiosConfig: AxiosRequestConfig = {
				headers: { "User-Agent": config.userAgent },
				timeout: 10000,
				httpAgent,
				httpsAgent,
				validateStatus: () => true, // Don't throw on non-200 status codes so we can handle them
				signal: abortSignal, // Abort the request if signal is aborted
				responseType: "arraybuffer", // Crucial: get raw bytes to handle non-UTF8 or binary data correctly
			};

			if (proxyConfig) {
				axiosConfig.proxy = {
					protocol: proxyConfig.protocol,
					host: proxyConfig.host,
					port: proxyConfig.port,
				};
			}

			const startTime = Date.now();
			let response: AxiosResponse | undefined;
			try {
				response = await axios.get(url, axiosConfig);
			} catch (err: unknown) {
				if (
					axios.isCancel(err) ||
					(err instanceof Error && err.name === "AbortError")
				) {
					console.log(`[Fetcher] Request aborted for ${url}`);
					// Requeue it since it was aborted, or just discard if stopped
					if (!(await this.frontier.isStopped())) {
						await this.frontier.addUrl(url, depth, originalDomain);
					}
					return { aborted: true };
				}

				const errorMsg = err instanceof Error ? err.message : String(err);
				// Network error (timeout, connection refused, etc.)
				console.error(`[Fetcher] Network error fetching ${url}:`, errorMsg);
				if (proxyConfig) {
					proxyManager.reportFailure(proxyConfig);
				}
				// We still update dynamic delay based on network error if needed
				updateDynamicDelay(
					url,
					config.crawlDelayMs,
					500,
					Date.now() - startTime,
				);
				return false;
			}

			if (!response) {
				console.error(`[Fetcher] No response received for ${url}`);
				return false;
			}

			const responseTime = Date.now() - startTime;
			updateDynamicDelay(
				url,
				config.crawlDelayMs,
				response.status,
				responseTime,
			);

			if (
				response.status === 429 ||
				response.status === 503 ||
				response.status === 403
			) {
				console.warn(
					`[Fetcher] Received ${response.status} from ${url}. Returning false to trigger Bull retry with exponential backoff.`,
				);
				if (proxyConfig) {
					proxyManager.reportFailure(proxyConfig);
				}
				return false;
			}

			if (response.status !== 200 || !response.data) {
				console.error(
					`[Fetcher] Failed to fetch ${url}, status: ${response.status}`,
				);
				if (proxyConfig && response.status >= 500) {
					proxyManager.reportFailure(proxyConfig);
				}
				return false;
			}

			if (proxyConfig) {
				proxyManager.reportSuccess(proxyConfig);
			}

			let contentTypeRaw = "";
			if (response) {
				const headersObj = response.headers as Record<string, string>;
				contentTypeRaw =
					headersObj["content-type"] || headersObj["Content-Type"] || "";
			}
			const contentType = ((contentTypeRaw || "").split(";")[0] || "")
				.trim()
				.toLowerCase();

			let content: string | Buffer;
			const rawData = response ? response.data : "";
			if (Buffer.isBuffer(rawData)) {
				content = rawData;
			} else if (rawData instanceof ArrayBuffer) {
				content = Buffer.from(rawData);
			} else if (typeof rawData === "string") {
				content = rawData;
			} else {
				content = JSON.stringify(rawData || "");
			}

			// Parse Data (HTML or otherwise)
			let parsed = await this.parser.parse(
				url,
				content,
				originalDomain,
				contentType,
			);
			let { title, links, text } = parsed;

			// Detect SPA (Only makes sense for HTML)
			if (contentType.includes("html") && typeof content === "string") {
				if (this.isSuspectedSPA(content, links.length)) {
					console.log(
						`[Fetcher] Suspected SPA detected for ${url}. Handing over to Renderer Agent.`,
					);
					try {
						const renderedHtml = await this.renderer?.render(url, abortSignal);
						if (renderedHtml) {
							content = renderedHtml;
							// Re-parse with the rendered HTML
							parsed = await this.parser.parse(
								url,
								content,
								originalDomain,
								contentType,
							);
							title = parsed.title;
							links = parsed.links;
							text = parsed.text;
						}
					} catch (renderError) {
						if (
							renderError instanceof Error &&
							renderError.message === "Aborted"
						) {
							console.log(`[Fetcher] Renderer aborted for ${url}`);
							if (!(await this.frontier.isStopped())) {
								await this.frontier.addUrl(url, depth, originalDomain);
							}
							return { aborted: true };
						}
						console.error(
							`[Fetcher] Renderer failed for ${url}, falling back to raw HTML.`,
							renderError,
						);
					}
				}
			}

			// Content Duplicate Eliminator
			if (this.eliminator.isDuplicateContent(text)) {
				console.log(
					`[Fetcher] Duplicate or mirrored content detected for ${url}. Dropping.`,
				);
				return true;
			}

			// Save raw Data
			const stringContent = Buffer.isBuffer(content)
				? content.toString("utf-8")
				: (content as string);

			await this.storage.saveRawHtml(url, stringContent);
			console.log(
				`[Fetcher] Stored raw data for ${url} (Optimized with ${config.compressionAlgo || "brotli"})`,
			);

			// Save parsed metadata
			await this.storage.saveParsedData(url, {
				title,
				links,
				extractedData: parsed.extractedData,
			});
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
			if (error instanceof Error && error.name === "AbortError") {
				console.log(`[Fetcher] Aborted fetch for ${url}`);
				// Don't log this as a failure, it was gracefully aborted
				if (!(await this.frontier.isStopped())) {
					await this.frontier.addUrl(url, depth, originalDomain);
				}
				return { aborted: true };
			}

			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`[Fetcher] Error fetching ${url}:`, errorMessage);
			return false;
		}
	}

	startListening() {
		const queue = this.frontier.getQueue();
		const abortControllers = new Set<AbortController>();

		this.frontier.initializeSubscribers().then(() => {
			this.frontier.on("control", (data: { action: string }) => {
				console.log(`[Fetcher] Received control action: ${data.action}`);
				if (
					data.action === "pause" ||
					data.action === "stop" ||
					data.action === "empty"
				) {
					// Abort all in-flight jobs
					console.log(
						`[Fetcher] Aborting ${abortControllers.size} in-flight jobs due to ${data.action}`,
					);
					for (const controller of abortControllers) {
						controller.abort();
					}
					abortControllers.clear();
				}
			});
		});

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
				return;
			}
			console.error("[Fetcher] Queue encountered an error:", error);
		});

		queue.on("failed", (job, error) => {
			if (job.attemptsMade >= (job.opts.attempts || 3)) {
				console.warn(
					`[Fetcher] Job ${job.id} for ${job.data.url} failed completely and moved to Dead-Letter Queue. Error: ${error.message}`,
				);
			}
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
				const controller = new AbortController();
				abortControllers.add(controller);

				try {
					const success = await this.fetchAndProcess(
						url,
						depth,
						originalDomain,
						controller.signal,
					);
					if (!success) {
						throw new Error(`Failed to process ${url}`);
					}

					if (typeof success === "object" && success.aborted) {
						return {
							success: true,
							aborted: true,
							url,
							podName: config.podName,
						};
					}

					return { success: true, url, podName: config.podName };
				} finally {
					abortControllers.delete(controller);
				}
			});
		}

		console.log(
			`[Fetcher] Agent started listening to partitions [${partitionsToProcess.join(",")}] with concurrency ${config.fetcherConcurrency} on pod ${config.podName}`,
		);
	}
}
