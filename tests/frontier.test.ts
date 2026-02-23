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
			async pause(isLocal: boolean, doNotWaitActive: boolean) {
				return { isLocal, doNotWaitActive };
			}
			async resume(isLocal: boolean) {
				return { isLocal };
			}
			async empty() {
				return true;
			}
			async isPaused(isLocal: boolean) {
				return false;
			}
			client = {
				get: async (key: string) => this._store[key],
				set: async (key: string, val: string) => {
					this._store[key] = val;
				},
				del: async (key: string) => {
					delete this._store[key];
				},
			};
			_store: Record<string, string> = {};
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

	test("should properly call pause on the queue with doNotWaitActive = true", async () => {
		const result = await frontier.pause(false);
		expect(result).toEqual({ isLocal: false, doNotWaitActive: true } as any);
	});

	test("should properly call empty on the queue", async () => {
		const result = await frontier.empty();
		expect(result).toBe(true as any);
	});

	test("should properly call stop on the queue and set isStopped to true", async () => {
		await frontier.stop();
		expect(await frontier.isStopped()).toBe(true);
	});

	test("should properly call resume on the queue and set isStopped to false", async () => {
		await frontier.resume(false);
		expect(await frontier.isStopped()).toBe(false);
	});
});
