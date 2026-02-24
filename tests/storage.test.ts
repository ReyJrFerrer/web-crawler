import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { config } from "../src/config";
import { S3ObjectStorageAdapter } from "../src/services/object-storage";
import { StorageService } from "../src/services/storage";
import { compressData } from "../src/utils/storage-optimizer";

// Export mock var to control behavior
export const mockState = { shouldThrowAccessDenied: false };

// Mock AWS SDK
let s3ClientConfig: any = {};
mock.module("@aws-sdk/client-s3", () => {
	return {
		S3Client: class MockS3Client {
			constructor(config: any) {
				s3ClientConfig = config;
			}
			async send(command: any) {
				if (
					mockState.shouldThrowAccessDenied &&
					command.constructor.name === "PutBucketLifecycleConfigurationCommand"
				) {
					const err: any = new Error("Access Denied");
					err.name = "AccessDenied";
					err.$metadata = { httpStatusCode: 403 };
					throw err;
				}

				if (command.constructor.name === "GetObjectCommand") {
					return {
						Body: (async function* () {
							yield await compressData(
								"<html><body>s3 content</body></html>",
								"brotli",
							);
						})(),
					};
				}
				return {};
			}
		},
		PutObjectCommand: class {},
		GetObjectCommand: class {},
		DeleteObjectCommand: class {},
	};
});

// Mock MongoDB
mock.module("mongodb", () => {
	return {
		MongoClient: class MockMongoClient {
			async connect() {
				return this;
			}
			db(_name: string) {
				return {
					collection(_name: string) {
						return {
							insertOne: async (_doc: any) => ({ insertedId: "mockId" }),
							findOne: async (query: any) => {
								if (query.url === "http://example.com/s3") {
									return {
										url: "http://example.com/s3",
										s3Key: "testkey.html",
										algo: "brotli",
									};
								}
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

	test("should retrieve and decompress raw HTML from S3", async () => {
		const html = await storage.getRawHtml("http://example.com/s3");
		expect(html).toBe("<html><body>s3 content</body></html>");
	});

	test("should retrieve and decompress raw HTML from Mongo fallback", async () => {
		const html = await storage.getRawHtml("http://example.com/brotli");
		expect(html).toBe("<html><body>test</body></html>");
	});

	test("should store parsed metadata including extractedData", async () => {
		const result = await storage.saveParsedData("http://example.com", {
			title: "Test",
			links: [],
			extractedData: { testPlugin: { data: "value" } },
		});
		expect(result.insertedId).toBeDefined();
	});

	test("should correct s3Endpoint to avoid ERR_TLS_CERT_ALTNAME_INVALID", () => {
		// Mock a misconfigured user environment where they included the bucket name in the endpoint
		config.s3BucketName = "my-bucket";
		config.s3Endpoint = "https://my-bucket.sfo3.digitaloceanspaces.com";

		const adapter = new S3ObjectStorageAdapter();

		// The client config should have the cleaned endpoint
		expect(s3ClientConfig.endpoint).toBe("https://sfo3.digitaloceanspaces.com");
	});

	test("should gracefully handle AccessDenied when configuring lifecycle rules", async () => {
		const originalStatus = mockState.shouldThrowAccessDenied;
		mockState.shouldThrowAccessDenied = true;

		const adapter = new S3ObjectStorageAdapter();

		// Capture console.warn to verify our custom message is fired
		let warned = false;
		const originalWarn = console.warn;
		console.warn = (msg: string) => {
			if (
				msg.includes("WARN: Your DigitalOcean Spaces API key lacks permission")
			) {
				warned = true;
			}
		};

		// Should not throw, should gracefully catch and warn
		await adapter.setupLifecycle();
		expect(warned).toBe(true);

		console.warn = originalWarn;
		mockState.shouldThrowAccessDenied = originalStatus;
	});
});
