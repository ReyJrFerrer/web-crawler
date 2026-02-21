import { DuplicateEliminator } from "./agents/eliminator";
import { FetcherAgent } from "./agents/fetcher";
import { ParserAgent } from "./agents/parser";
import { RendererAgent } from "./agents/renderer";
import { config } from "./config";
import { Frontier } from "./services/frontier";
import { StorageService } from "./services/storage";

async function main() {
	console.log("[Orchestrator] Starting Scalable Web Crawler System");

	// Debug: show config values
	console.log(
		`[Config] useRenderer=${config.useRenderer}, maxDepth=${config.maxDepth}, concurrency=${config.fetcherConcurrency}`,
	);

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

	let renderer: RendererAgent | null = null;
	if (config.useRenderer) {
		try {
			const r = new RendererAgent();
			await r.init();
			renderer = r;
			console.log("[Orchestrator] Initialized Renderer Agent (Puppeteer)");
		} catch (err) {
			console.warn(
				"[Orchestrator] Failed to initialize Renderer Agent — continuing without JavaScript rendering:",
				(err as Error).message,
			);
			renderer = null;
		}
	}

	// Init Fetcher Agent
	const fetcher = new FetcherAgent(
		frontier,
		storage,
		parser,
		eliminator,
		renderer,
	);

	// Start pipeline
	fetcher.startListening();

	console.log("[Orchestrator] System running and waiting for seeds.");

	// Graceful shutdown
	process.on("SIGINT", async () => {
		console.log("[Orchestrator] Shutting down...");
		if (renderer) {
			await renderer.close();
		}
		await frontier.close();
		await storage.close();
		process.exit(0);
	});
}

main().catch(console.error);
