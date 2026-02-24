import crypto from "node:crypto";
import { type Collection, type Db, MongoClient } from "mongodb";
import { config } from "../config";
import {
	type CompressionAlgo,
	compressData,
	decompressData,
} from "../utils/storage-optimizer";
import {
	type ObjectStorageAdapter,
	S3ObjectStorageAdapter,
} from "./object-storage";

export interface RawHtmlDoc {
	url: string;
	html?: string | Buffer; // Optional if stored in S3
	s3Key?: string; // The object storage key
	crawledAt: Date;
	algo?: string; // e.g., 'brotli', 'gzip', 'none'
}

export interface ParsedDataDoc {
	url: string;
	title: string;
	links: string[];
	parsedAt: Date;
	extractedData?: Record<string, unknown>;
}

export class StorageService {
	private client: MongoClient;
	private db: Db | null = null;
	private rawCollection: Collection<RawHtmlDoc> | null = null;
	private parsedCollection: Collection<ParsedDataDoc> | null = null;

	private algo: CompressionAlgo;
	private objectStorage: ObjectStorageAdapter | null = null;

	constructor() {
		this.client = new MongoClient(config.mongoUrl);
		this.algo = config.compressionAlgo || "brotli";

		if (config.s3Endpoint || config.s3AccessKeyId) {
			this.objectStorage = new S3ObjectStorageAdapter();
		}
	}

	async connect() {
		await this.client.connect();
		this.db = this.client.db();
		this.rawCollection = this.db.collection("rawHtml");
		this.parsedCollection = this.db.collection("parsedData");

		if (this.objectStorage) {
			await this.objectStorage.setupLifecycle();
		}
	}

	async saveRawHtml(url: string, html: string) {
		if (!this.rawCollection) throw new Error("Database not connected");

		let storedHtml: string | Buffer | undefined = html;
		let storedAlgo = "none";
		let s3Key: string | undefined;

		if (this.objectStorage) {
			// Save to S3
			s3Key = `${crypto.createHash("sha256").update(url).digest("hex")}.html`;
			storedAlgo = this.algo !== "none" ? this.algo : "brotli";
			await this.objectStorage.putObject(
				s3Key,
				html,
				storedAlgo as CompressionAlgo,
			);
			storedHtml = undefined; // Don't save HTML body in MongoDB
		} else {
			// Save to Mongo Fallback
			if (this.algo !== "none") {
				try {
					storedHtml = await compressData(html, this.algo);
					storedAlgo = this.algo;
				} catch (error) {
					console.error(`[Storage] Failed to compress HTML for ${url}:`, error);
				}
			}
		}

		return this.rawCollection.insertOne({
			url,
			html: storedHtml,
			s3Key,
			algo: storedAlgo,
			crawledAt: new Date(),
		});
	}

	async getRawHtml(url: string): Promise<string | null> {
		if (!this.rawCollection) throw new Error("Database not connected");
		const doc = await this.rawCollection.findOne({ url });
		if (!doc) return null;

		// Fetch from S3 if s3Key exists
		if (doc.s3Key && this.objectStorage) {
			try {
				return await this.objectStorage.getObject(
					doc.s3Key,
					(doc.algo as CompressionAlgo) || "brotli",
				);
			} catch (error) {
				console.error(
					`[Storage] Failed to get HTML from S3 for ${url}:`,
					error,
				);
				return null;
			}
		}

		// Fallback to Mongo
		if (!doc.html) return null;

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

	async getMetadataList(limit = 100): Promise<RawHtmlDoc[]> {
		if (!this.rawCollection) throw new Error("Database not connected");
		return this.rawCollection
			.find({}, { projection: { url: 1, s3Key: 1, crawledAt: 1, algo: 1 } })
			.sort({ crawledAt: -1 })
			.limit(limit)
			.toArray() as Promise<RawHtmlDoc[]>;
	}

	async close() {
		await this.client.close();
	}
}
