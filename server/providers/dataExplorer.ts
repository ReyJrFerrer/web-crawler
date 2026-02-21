import { MongoClient } from "mongodb";
import { config } from "../../src/config";

export interface DataRecord {
	id: string;
	url: string;
	status: number;
	title: string;
	linksFound: number;
	timestamp: string;
}

const MOCK: DataRecord[] = [
	{
		id: "64a1b2c3",
		url: "https://example.com/about",
		status: 200,
		title: "About Us - Example Corp",
		linksFound: 45,
		timestamp: "2026-02-20T10:05:00Z",
	},
	{
		id: "64a1b2c4",
		url: "https://example.com/contact",
		status: 404,
		title: "Not Found",
		linksFound: 0,
		timestamp: "2026-02-20T10:05:02Z",
	},
	{
		id: "64a1b2c5",
		url: "https://wikipedia.org/wiki/Web_crawler",
		status: 200,
		title: "Web crawler - Wikipedia",
		linksFound: 132,
		timestamp: "2026-02-20T10:05:08Z",
	},
	{
		id: "64a1b2c6",
		url: "https://example.com/products",
		status: 200,
		title: "Products - Example Corp",
		linksFound: 27,
		timestamp: "2026-02-20T10:05:15Z",
	},
	{
		id: "64a1b2c7",
		url: "https://badsite.com/page",
		status: 503,
		title: "Service Unavailable",
		linksFound: 0,
		timestamp: "2026-02-20T10:05:20Z",
	},
];

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
			url: doc["url"] as string,
			status: (doc["status"] as number | undefined) ?? 200,
			title: (doc["title"] as string | undefined) ?? "(no title)",
			linksFound: Array.isArray(doc["links"])
				? (doc["links"] as unknown[]).length
				: 0,
			timestamp: (doc["parsedAt"] instanceof Date
				? doc["parsedAt"]
				: new Date()
			).toISOString(),
		}));
	} catch {
		return MOCK;
	}
}
