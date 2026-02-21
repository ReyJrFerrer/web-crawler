import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import Queue from "bull";
import { Frontier } from "../src/services/frontier";

mock.module("bull", () => {
	return {
		default: class MockQueue {
			name: string;
			constructor(name: string) {
				this.name = name;
			}
			async add(...args: any[]) {
				const name = typeof args[0] === "string" ? args[0] : "default";
				const data = typeof args[0] === "string" ? args[1] : args[0];
				return { name, data };
			}
			async close() {
				return true;
			}
		},
	};
});

describe("Frontier Service", () => {
	let frontier: Frontier;

	beforeAll(() => {
		frontier = new Frontier("test-queue");
	});

	afterAll(async () => {
		await frontier.close();
	});

	test("should use hash routing to partition domains", async () => {
		// example.com and test.com will likely hash to different partitions,
		// but multiple calls with the same domain must yield the same partition.
		const job1 = await frontier.addUrl("http://example.com/page1", 0);
		const job2 = await frontier.addUrl("http://example.com/page2", 0);
		const job3 = await frontier.addUrl("http://test.com/something", 0);

		expect(job1?.name).toMatch(/^partition-\d+$/);
		expect(job1?.name).toBe(job2?.name); // Same domain -> Same partition

		// Though there's a small chance test.com hashes to the same partition depending on QUEUE_PARTITIONS (default 10)
		// We just verify it produces a valid partition name
		expect(job3?.name).toMatch(/^partition-\d+$/);
	});

	test("should use originalDomain for hash routing if provided", async () => {
		const job1 = await frontier.addUrl(
			"http://example.com/page1",
			0,
			"test.com",
		);
		const job2 = await frontier.addUrl("http://test.com/something", 0);

		expect(job1?.name).toBe(job2?.name); // Because job1 was forced to use 'test.com'
	});
});
