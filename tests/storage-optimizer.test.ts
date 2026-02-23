import { describe, expect, test } from "bun:test";
import { compressData, decompressData } from "../src/utils/storage-optimizer";

describe("StorageOptimizer", () => {
	const rawHtml =
		"<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>".repeat(
			10,
		);

	test("should compress and decompress using brotli", async () => {
		const compressed = await compressData(rawHtml, "brotli");
		expect(compressed).toBeInstanceOf(Buffer);
		expect(compressed.byteLength).toBeLessThan(Buffer.from(rawHtml).byteLength);

		const decompressed = await decompressData(compressed, "brotli");
		expect(decompressed).toBe(rawHtml);
	});

	test("should compress and decompress using gzip", async () => {
		const compressed = await compressData(rawHtml, "gzip");
		expect(compressed).toBeInstanceOf(Buffer);
		expect(compressed.byteLength).toBeLessThan(Buffer.from(rawHtml).byteLength);

		const decompressed = await decompressData(compressed, "gzip");
		expect(decompressed).toBe(rawHtml);
	});

	test("should return raw string when using none", async () => {
		const compressed = await compressData(rawHtml, "none");
		expect(compressed).toBeInstanceOf(Buffer);

		const decompressed = await decompressData(compressed, "none");
		expect(decompressed).toBe(rawHtml);
	});
});
