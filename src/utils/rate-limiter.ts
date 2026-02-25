// Tracks the last fetch time for a specific domain origin
const domainLastFetch = new Map<string, number>();

// Tracks the dynamic delay for a specific domain origin
const domainDynamicDelay = new Map<string, number>();

export class AbortError extends Error {
	constructor(message = "Aborted") {
		super(message);
		this.name = "AbortError";
	}
}

/**
 * Ensures that requests to the same domain are separated by a dynamic delay.
 */
export async function enforcePerDomainRateLimit(
	url: string,
	baseDelayMs: number,
	abortSignal?: AbortSignal,
): Promise<void> {
	try {
		const origin = new URL(url).origin;
		const now = Date.now();
		const lastFetch = domainLastFetch.get(origin) || 0;
		const currentDelay = domainDynamicDelay.get(origin) || baseDelayMs;

		// Calculate the exact time this request should execute
		const targetFetchTime = Math.max(now, lastFetch + currentDelay);

		// Update the last fetch time immediately so concurrent requests queue up sequentially
		domainLastFetch.set(origin, targetFetchTime);

		const waitTime = targetFetchTime - now;

		if (waitTime > 0) {
			// console.log(`[Rate Limiter] Waiting ${waitTime}ms for ${origin}`);
			await new Promise<void>((resolve, reject) => {
				if (abortSignal?.aborted) {
					return reject(new AbortError());
				}

				const timeoutId = setTimeout(() => {
					abortSignal?.removeEventListener("abort", onAbort);
					resolve();
				}, waitTime);

				const onAbort = () => {
					clearTimeout(timeoutId);
					reject(new AbortError());
				};

				abortSignal?.addEventListener("abort", onAbort);
			});
		}
	} catch (error) {
		if (error instanceof AbortError) {
			throw error;
		}
		// Just proceed if URL is invalid, letting fetcher fail
	}
}

/**
 * Updates the dynamic delay based on response status and time.
 * Implements exponential backoff on 429/503 and gradual recovery on success.
 */
export function updateDynamicDelay(
	url: string,
	baseDelayMs: number,
	statusCode: number,
	responseTimeMs: number,
): void {
	try {
		const origin = new URL(url).origin;
		let currentDelay = domainDynamicDelay.get(origin) || baseDelayMs;

		const maxDelayMs = Math.max(baseDelayMs * 10, 60000); // Max 60 seconds

		if (statusCode === 429 || statusCode === 503) {
			// Severe degradation or explicit rate limit: double the delay
			currentDelay = Math.min(currentDelay * 2, maxDelayMs);
			console.log(
				`[Politeness] Server backing off for ${origin}. New delay: ${currentDelay}ms`,
			);
		} else if (statusCode >= 400 && statusCode < 500 && statusCode !== 404) {
			// Other client errors (except 404) might be WAF blocks: increase delay by 50%
			currentDelay = Math.min(Math.floor(currentDelay * 1.5), maxDelayMs);
			console.log(
				`[Politeness] WAF mitigation for ${origin}. New delay: ${currentDelay}ms`,
			);
		} else if (responseTimeMs > baseDelayMs * 2) {
			// Slow response: increase delay proportionally
			currentDelay = Math.min(Math.floor(currentDelay * 1.2), maxDelayMs);
		} else if (statusCode === 200) {
			// Success and fast response: gradually decrease delay back to base
			if (currentDelay > baseDelayMs) {
				currentDelay = Math.max(Math.floor(currentDelay * 0.9), baseDelayMs);
			}
		}

		domainDynamicDelay.set(origin, currentDelay);
	} catch (_error) {
		// Ignore invalid URLs
	}
}
