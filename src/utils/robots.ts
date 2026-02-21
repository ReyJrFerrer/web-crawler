import Redis from "ioredis";
import robotsParser from "robots-parser";
import { config } from "../config";

const redis = new Redis(config.redisUrl);

/**
 * [Section 5.1] Politeness Policy
 * Downloads, caches, and parses a domain's robots.txt rules.
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
	try {
		const urlObj = new URL(url);
		const origin = urlObj.origin;
		const cacheKey = `robots_txt:${origin}`;

		let robotsTxtContent = await redis.get(cacheKey);

		if (robotsTxtContent === null) {
			console.log(`[Politeness] Fetching rules for ${origin}...`);
			try {
				const response = await fetch(`${origin}/robots.txt`);
				robotsTxtContent = response.ok ? await response.text() : "";
			} catch (_e) {
				robotsTxtContent = ""; // Default to allow if server is unreachable
			}

			// Cache rules for 24 hours (86400 seconds)
			await redis.setex(cacheKey, 86400, robotsTxtContent);
		}

		const robots = robotsParser(`${origin}/robots.txt`, robotsTxtContent);
		const allowed = robots.isAllowed(url, config.userAgent);

		return allowed === undefined ? true : allowed;
	} catch (_error) {
		// If the URL is malformed, we block it to be safe
		return false;
	}
}

export async function closeRobotsCache() {
	await redis.quit();
}
