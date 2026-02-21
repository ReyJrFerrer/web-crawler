// Tracks the last fetch time for a specific domain origin
const domainLastFetch = new Map<string, number>();

/**
 * Ensures that requests to the same domain are separated by `delayMs` milliseconds.
 */
export async function enforcePerDomainRateLimit(
	url: string,
	delayMs: number,
): Promise<void> {
	try {
		const origin = new URL(url).origin;
		const now = Date.now();
		const lastFetch = domainLastFetch.get(origin) || 0;
		const timeSinceLastFetch = now - lastFetch;

		if (timeSinceLastFetch < delayMs) {
			const waitTime = delayMs - timeSinceLastFetch;
			// console.log(`[Rate Limiter] Waiting ${waitTime}ms for ${origin}`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		// Update the last fetch time to "now + waitTime" (effectively when it's done waiting)
		domainLastFetch.set(origin, Date.now());
	} catch (_error) {
		// Just proceed if URL is invalid, letting fetcher fail
	}
}
