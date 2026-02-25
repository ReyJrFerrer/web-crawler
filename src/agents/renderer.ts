import puppeteer, { type Browser, type Page } from "puppeteer";
import { config } from "../config";

export class RendererAgent {
	private browser: Browser | null = null;
	private requestCount = 0;
	private readonly MAX_REQUESTS_BEFORE_RESTART = 50;

	async init() {
		if (!this.browser) {
			console.log("[Renderer] Launching headless browser context...");
			this.browser = await puppeteer.launch({
				headless: true,
				args: [
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-dev-shm-usage",
					"--disable-gpu",
				],
			});
			this.requestCount = 0;
		}
	}

	async render(url: string, abortSignal?: AbortSignal): Promise<string> {
		if (!this.browser) {
			await this.init();
		}

		this.requestCount++;
		if (this.requestCount > this.MAX_REQUESTS_BEFORE_RESTART) {
			console.log(
				`[Renderer] Restarting browser to prevent memory leaks (limit ${this.MAX_REQUESTS_BEFORE_RESTART} reached).`,
			);
			await this.close();
			await this.init();
		}

		let page: Page | null = null;

		if (abortSignal?.aborted) {
			throw new Error("Aborted");
		}

		try {
			if (!this.browser) {
				throw new Error("Browser not initialized");
			}
			page = await this.browser.newPage();
			await page.setUserAgent(config.userAgent);

			// Optimize rendering by blocking unnecessary resources
			await page.setRequestInterception(true);
			page.on("request", (req) => {
				const type = req.resourceType();
				if (["image", "media", "font", "stylesheet"].includes(type)) {
					req.abort();
				} else {
					req.continue();
				}
			});

			const onAbort = () => {
				if (page) {
					console.log(`[Renderer] Aborting SPA render for ${url}`);
					page.close().catch(() => {});
				}
			};

			abortSignal?.addEventListener("abort", onAbort);

			console.log(`[Renderer] Rendering SPA for ${url}`);
			// 30 seconds timeout, waiting for network idle
			const responsePromise = page.goto(url, {
				waitUntil: "networkidle2",
				timeout: 30000,
			});

			// We cannot natively abort page.goto in puppeteer with an AbortSignal,
			// but we can expose the page object so the caller could try to close it,
			// or we can just wait for it.
			await responsePromise;

			abortSignal?.removeEventListener("abort", onAbort);
			if (abortSignal?.aborted) throw new Error("Aborted");

			const html = await page.content();
			return html;
		} catch (error) {
			console.error(`[Renderer] Error rendering ${url}:`, error);
			throw error;
		} finally {
			if (page) {
				await page.close().catch(() => {});
			}
		}
	}

	async close() {
		if (this.browser) {
			console.log("[Renderer] Closing browser context...");
			await this.browser.close();
			this.browser = null;
		}
	}
}
