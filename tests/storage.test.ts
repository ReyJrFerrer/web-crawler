import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { MongoClient } from "mongodb";
import { StorageService } from "../src/services/storage";
import { compressData } from "../src/utils/storage-optimizer";

// Mock MongoDB
mock.module("mongodb", () => {
	return {
		MongoClient: class MockMongoClient {
			async connect() {
				return this;
			}
			db(name: string) {
				return {
					collection(name: string) {
						return {
							insertOne: async (doc: any) => ({ insertedId: "mockId" }),
							findOne: async (query: any) => {
								if (query.url === "http://example.com/brotli") {
									return {
										url: "http://example.com/brotli",
										html: await compressData(
											"<html><body>test</body></html>",
											"brotli",
										),
										algo: "brotli",
									};
								}
								return null;
							},
						};
					},
				};
			}
			async close() {}
		},
	};
});

describe("Storage Service", () => {
	let storage: StorageService;

	beforeAll(async () => {
		storage = new StorageService();
		await storage.connect();
	});

	afterAll(async () => {
		await storage.close();
	});

	test("should store raw HTML", async () => {
		const result = await storage.saveRawHtml(
			"http://example.com",
			"<html><body>test</body></html>",
		);
		expect(result.insertedId).toBeDefined();
	});

	test("should retrieve and decompress raw HTML", async () => {
		const html = await storage.getRawHtml("http://example.com/brotli");
		expect(html).toBe("<html><body>test</body></html>");
	});

	test("should store parsed metadata", async () => {
		const result = await storage.saveParsedData("http://example.com", {
			title: "Test",
			links: [],
		});
		expect(result.insertedId).toBeDefined();
	});
});
