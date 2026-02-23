import { type Collection, type Db, MongoClient } from "mongodb";
import { config } from "../config";
import {
	type CompressionAlgo,
	compressData,
	decompressData,
} from "../utils/storage-optimizer";

export interface RawHtmlDoc {
	url: string;
	html: string | Buffer;
	crawledAt: Date;
	algo?: string; // e.g., 'brotli', 'gzip', 'none'
}

export interface ParsedDataDoc {
	url: string;
	title: string;
	links: string[];
	parsedAt: Date;
}

export class StorageService {
	private client: MongoClient;
	private db: Db | null = null;
	private rawCollection: Collection<RawHtmlDoc> | null = null;
	private parsedCollection: Collection<ParsedDataDoc> | null = null;

	private algo: CompressionAlgo;

	constructor() {
		this.client = new MongoClient(config.mongoUrl);
		this.algo = config.compressionAlgo || "brotli";
	}

	async connect() {
		await this.client.connect();
		this.db = this.client.db();
		this.rawCollection = this.db.collection("rawHtml");
		this.parsedCollection = this.db.collection("parsedData");

		// Optional: Create indexes
		// TO CHECK
		// await this.rawCollection.createIndex({ url: 1 }, { unique: true });
		// await this.parsedCollection.createIndex({ url: 1 }, { unique: true });
	}

	async saveRawHtml(url: string, html: string) {
		if (!this.rawCollection) throw new Error("Database not connected");

		let storedHtml: string | Buffer = html;
		let storedAlgo = "none";

		if (this.algo !== "none") {
			try {
				storedHtml = await compressData(html, this.algo);
				storedAlgo = this.algo;
			} catch (error) {
				console.error(`[Storage] Failed to compress HTML for ${url}:`, error);
				// fallback to raw string on error
			}
		}

		return this.rawCollection.insertOne({
			url,
			html: storedHtml,
			algo: storedAlgo,
			crawledAt: new Date(),
		});
	}

	async getRawHtml(url: string): Promise<string | null> {
		if (!this.rawCollection) throw new Error("Database not connected");
		const doc = await this.rawCollection.findOne({ url });
		if (!doc) return null;

		if (doc.algo && doc.algo !== "none" && doc.html instanceof Buffer) {
			try {
				return await decompressData(doc.html, doc.algo as CompressionAlgo);
			} catch (error) {
				console.error(`[Storage] Failed to decompress HTML for ${url}:`, error);
				return null;
			}
		}

		return doc.html.toString();
	}

	async saveParsedData(
		url: string,
		data: Omit<ParsedDataDoc, "url" | "parsedAt">,
	) {
		if (!this.parsedCollection) throw new Error("Database not connected");
		return this.parsedCollection.insertOne({
			url,
			...data,
			parsedAt: new Date(),
		});
	}

	async close() {
		await this.client.close();
	}
}
