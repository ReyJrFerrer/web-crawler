import { Frontier } from "./services/frontier";

async function monitor() {
	const frontier = new Frontier();
	const queue = frontier.getQueue();

	console.log("📊 Web Crawler System - Live Monitor Dashboard");
	console.log("==============================================");

	try {
		// Get job counts natively supported by bull
		const counts = await queue.getJobCounts();

		console.log(`⏳ Waiting (Frontier):   ${counts.waiting}`);
		console.log(`🚀 Active (Fetching):    ${counts.active}`);
		console.log(`✅ Completed (Success):  ${counts.completed}`);
		console.log(`❌ Failed (Dead-Letter): ${counts.failed}`);
		console.log(`⏸️  Delayed (Retries):    ${counts.delayed}`);

		console.log("==============================================");
	} catch (error) {
		console.error("Failed to read queue stats:", error);
	} finally {
		await frontier.close();
		process.exit(0);
	}
}

monitor();
