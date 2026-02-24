import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DecompressorService } from "../src/services/decompressor";

describe("DecompressorService", () => {
	let service: DecompressorService;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "crawler-test-"));
		service = new DecompressorService();

		// Mock StorageService methods
		// @ts-expect-error - accessing private property for mocking
		service.storage = {
			connect: mock(async () => {}),
			close: mock(async () => {}),
			getMetadataList: mock(async (_limit = 100) => [
				{
					url: "https://example.com/test1",
					s3Key: "test1.html",
					crawledAt: new Date(),
					algo: "brotli",
				},
				{
					url: "https://example.com/test2",
					crawledAt: new Date(),
					algo: "brotli",
				},
			]),
			getRawHtml: mock(async (url: string) => {
				if (url === "https://example.com/test1") {
					return "<html><body>Test 1 S3</body></html>";
				}
				if (url === "https://example.com/test2") {
					return "<html><body>Test 2 Mongo</body></html>";
				}
				return null;
			}),
		};
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("should retrieve available html documents metadata", async () => {
		const docs = await service.getAvailableHtmls();
		expect(docs?.length).toBe(2);
		expect(docs?.[0]?.url).toBe("https://example.com/test1");
		expect(docs?.[1]?.url).toBe("https://example.com/test2");
	});

	it("should fetch, decompress, and save html to the filesystem", async () => {
		const outputPath = path.join(tempDir, "output.html");

		const result = await service.decompressAndSave(
			"https://example.com/test1",
			outputPath,
		);
		expect(result).toBeTrue();

		// Verify file contents
		const content = await fs.readFile(outputPath, "utf-8");
		expect(content).toBe("<html><body>Test 1 S3</body></html>");
	});

	it("should create necessary subdirectories when saving", async () => {
		const nestedPath = path.join(
			tempDir,
			"deep",
			"nested",
			"folder",
			"output.html",
		);

		const result = await service.decompressAndSave(
			"https://example.com/test2",
			nestedPath,
		);
		expect(result).toBeTrue();

		// Verify file contents
		const content = await fs.readFile(nestedPath, "utf-8");
		expect(content).toBe("<html><body>Test 2 Mongo</body></html>");
	});

	it("should throw an error if html cannot be retrieved", async () => {
		const outputPath = path.join(tempDir, "output.html");

		expect(
			service.decompressAndSave("https://notfound.com", outputPath),
		).rejects.toThrow(
			"Could not retrieve or decompress HTML for URL: https://notfound.com",
		);
	});
});
