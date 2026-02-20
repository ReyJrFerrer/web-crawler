import { DuplicateEliminator } from "./agents/eliminator";
import { FetcherAgent } from "./agents/fetcher";
import { ParserAgent } from "./agents/parser";
import { Frontier } from "./services/frontier";
import { StorageService } from "./services/storage";

async function main() {
	console.log("[Orchestrator] Starting Scalable Web Crawler System");

	// Init Services
	const storage = new StorageService();
	await storage.connect();
	console.log("[Orchestrator] Connected to Storage (MongoDB)");

	const frontier = new Frontier();
	console.log("[Orchestrator] Connected to URL Frontier (Redis)");

	// Init Intelligence Layer Agents
	const parser = new ParserAgent();
	const eliminator = new DuplicateEliminator();
	console.log("[Orchestrator] Initialized Parser and Duplicate Eliminator");

	// Init Fetcher Agent
	const fetcher = new FetcherAgent(frontier, storage, parser, eliminator);

	// Start pipeline
	fetcher.startListening();

	console.log("[Orchestrator] System running and waiting for seeds.");

	// Graceful shutdown
	process.on("SIGINT", async () => {
		console.log("[Orchestrator] Shutting down...");
		await frontier.close();
		await storage.close();
		process.exit(0);
	});
}

main().catch(console.error);
