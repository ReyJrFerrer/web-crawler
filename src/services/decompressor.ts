import fs from "node:fs/promises";
import path from "node:path";
import prompts from "prompts";
import { StorageService } from "./storage";

export class DecompressorService {
	private storage: StorageService;

	constructor() {
		this.storage = new StorageService();
	}

	async connect() {
		await this.storage.connect();
	}

	async close() {
		await this.storage.close();
	}

	async getAvailableHtmls() {
		return await this.storage.getMetadataList(100);
	}

	async decompressAndSave(url: string, outputPath: string) {
		const html = await this.storage.getRawHtml(url);
		if (!html) {
			throw new Error(`Could not retrieve or decompress HTML for URL: ${url}`);
		}

		// Ensure directory exists
		const dir = path.dirname(outputPath);
		await fs.mkdir(dir, { recursive: true });

		await fs.writeFile(outputPath, html, "utf-8");
		return true;
	}

	async runCli() {
		try {
			console.log("Connecting to database and storage...");
			await this.connect();

			const docs = await this.getAvailableHtmls();

			if (docs.length === 0) {
				console.log("No stored HTML documents found.");
				return;
			}

			const choices = docs.map((doc) => ({
				title: `${doc.url} (Crawled: ${new Date(doc.crawledAt).toLocaleString()}) [${doc.s3Key ? "Object Storage" : "MongoDB"}]`,
				value: doc.url,
			}));

			const response = await prompts([
				{
					type: "autocomplete",
					name: "url",
					message: "Select an HTML document to decompress and view:",
					choices: choices,
					suggest: async (input, choices) => {
						return choices.filter((i) =>
							i.title.toLowerCase().includes((input || "").toLowerCase()),
						);
					},
				},
				{
					type: "text",
					name: "outputPath",
					message:
						"Enter the file path to save the HTML (e.g., ./output/page.html):",
					initial: "./output/downloaded.html",
				},
			]);

			if (!response.url || !response.outputPath) {
				console.log("Operation cancelled.");
				return;
			}

			console.log(`\nFetching and decompressing HTML for ${response.url}...`);
			await this.decompressAndSave(response.url, response.outputPath);
			console.log(
				`\n✅ Successfully saved to: ${path.resolve(response.outputPath)}`,
			);
		} catch (error) {
			console.error("\n❌ Error during decompression:", error);
		} finally {
			await this.close();
		}
	}
}

// Don't run CLI if just imported
if (require.main === module) {
	const service = new DecompressorService();
	service.runCli().catch((err) => {
		console.error("Fatal error:", err);
		process.exit(1);
	});
}
