import { MongoClient } from "mongodb";
import { config } from "../../../config.ts";

export interface DataRecord {
	id: string;
	url: string;
	status: number;
	title: string;
	linksFound: number;
	timestamp: string;
}

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
	if (!client) {
		client = new MongoClient(config.mongoUrl, {
			serverSelectionTimeoutMS: 3000,
		});
		await client.connect();
	}
	return client;
}

export async function getRecentData(limit = 20): Promise<DataRecord[]> {
	try {
		const c = await getClient();
		const db = c.db();
		const col = db.collection("parsedData");

		const docs = await col
			.find({})
			.sort({ parsedAt: -1 })
			.limit(limit)
			.toArray();

		return docs.map((doc) => ({
			id: doc._id.toString(),
			url: doc.url as string,
			status: (doc.status as number | undefined) ?? 200,
			title: (doc.title as string | undefined) ?? "(no title)",
			linksFound: Array.isArray(doc.links)
				? (doc.links as unknown[]).length
				: 0,
			timestamp: (doc.parsedAt instanceof Date
				? doc.parsedAt
				: new Date()
			).toISOString(),
		}));
	} catch {
		return [];
	}
}
