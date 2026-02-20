import { type Collection, type Db, MongoClient } from "mongodb";
import { config } from "../config";

export interface RawHtmlDoc {
	url: string;
	html: string;
	crawledAt: Date;
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

	constructor() {
		this.client = new MongoClient(config.mongoUrl);
	}

	async connect() {
		await this.client.connect();
		this.db = this.client.db();
		this.rawCollection = this.db.collection("rawHtml");
		this.parsedCollection = this.db.collection("parsedData");

		// Optional: Create indexes
		// await this.rawCollection.createIndex({ url: 1 }, { unique: true });
		// await this.parsedCollection.createIndex({ url: 1 }, { unique: true });
	}

	async saveRawHtml(url: string, html: string) {
		if (!this.rawCollection) throw new Error("Database not connected");
		return this.rawCollection.insertOne({
			url,
			html,
			crawledAt: new Date(),
		});
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
