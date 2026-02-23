import { beforeEach, describe, expect, test } from "bun:test";
import {
	enforcePerDomainRateLimit,
	updateDynamicDelay,
} from "../src/utils/rate-limiter";

describe("Dynamic Politeness", () => {
	test("should double delay on 429", async () => {
		const url = "http://test-dynamic.com";
		updateDynamicDelay(url, 2000, 429, 100);

		const start = Date.now();
		// Initial enforce should wait for nothing since last fetch is 0,
		// but wait we need to trigger it twice.
		await enforcePerDomainRateLimit(url, 2000);
		const afterFirst = Date.now();

		await enforcePerDomainRateLimit(url, 2000);
		const afterSecond = Date.now();

		const delay = afterSecond - afterFirst;
		expect(delay).toBeGreaterThanOrEqual(3900); // Should be roughly 4000ms
	});

	test("should gradually decrease delay on 200", async () => {
		const url = "http://test-success.com";
		// Force to 4000
		updateDynamicDelay(url, 2000, 429, 100);

		// Receive 200, fast response
		updateDynamicDelay(url, 2000, 200, 100);

		await enforcePerDomainRateLimit(url, 2000); // sets last fetch
		const start = Date.now();
		await enforcePerDomainRateLimit(url, 2000);
		const end = Date.now();
		const delay = end - start;

		// 4000 * 0.9 = 3600
		expect(delay).toBeGreaterThanOrEqual(3500);
		expect(delay).toBeLessThan(3900);
	});
});
