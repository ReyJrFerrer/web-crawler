import { MongoClient } from "mongodb";
import { config } from "../config";
import { S3ObjectStorageAdapter } from "../services/object-storage";

async function runCleanup() {
	console.log(`[Cleanup] Starting 30-day retention cleanup...`);
	const client = new MongoClient(config.mongoUrl);

	try {
		await client.connect();
		const db = client.db();
		const rawCollection = db.collection("rawHtml");

		let s3Adapter: S3ObjectStorageAdapter | null = null;
		if (config.s3Endpoint || config.s3AccessKeyId) {
			s3Adapter = new S3ObjectStorageAdapter();
		}

		const retentionDate = new Date();
		retentionDate.setDate(retentionDate.getDate() - config.s3RetentionDays);

		console.log(
			`[Cleanup] Searching for records older than: ${retentionDate.toISOString()}`,
		);

		// Find expired records
		const cursor = rawCollection.find({
			crawledAt: { $lt: retentionDate },
		});

		let deletedCount = 0;
		for await (const doc of cursor) {
			console.log(`[Cleanup] Deleting record for URL: ${doc.url}`);

			// Delete from S3 if s3Key exists
			if (doc.s3Key && s3Adapter) {
				try {
					await s3Adapter.deleteObject(doc.s3Key);
					console.log(`[Cleanup] Deleted S3 object: ${doc.s3Key}`);
				} catch (error) {
					console.error(
						`[Cleanup] Failed to delete S3 object ${doc.s3Key}:`,
						error,
					);
				}
			}

			// Delete from MongoDB
			await rawCollection.deleteOne({ _id: doc._id });
			deletedCount++;
		}

		console.log(`[Cleanup] Completed. Deleted ${deletedCount} old records.`);
	} catch (error) {
		console.error("[Cleanup] Error during retention cleanup:", error);
	} finally {
		await client.close();
		process.exit(0);
	}
}

runCleanup();
