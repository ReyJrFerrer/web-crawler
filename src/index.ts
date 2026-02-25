import { DuplicateEliminator } from "./agents/eliminator";
import { FetcherAgent } from "./agents/fetcher";
import { ParserAgent } from "./agents/parser";
import { RendererAgent } from "./agents/renderer";
import { config } from "./config";
import {
	ElasticsearchIndexerPlugin,
	MetadataExtractorPlugin,
} from "./plugins/index";
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

	// Branch logic based on ROLE
	if (config.role === "fetcher") {
		console.log(
			`[Fetcher Node] Running in dedicated fetcher mode on pod ${config.podName}`,
		);

		// Init Intelligence Layer Agents
		const parser = new ParserAgent();

		// Register production-ready plugins
		parser.registerPlugin(new MetadataExtractorPlugin());
		if (config.elasticsearchNode) {
			parser.registerPlugin(
				new ElasticsearchIndexerPlugin({
					node: config.elasticsearchNode,
					index: config.elasticsearchIndex,
					apiKey: config.elasticsearchApiKey,
				}),
			);
			console.log(
				`[Fetcher Node] Registered Elasticsearch Indexer Plugin (${config.elasticsearchNode})`,
			);
		}

		const eliminator = new DuplicateEliminator();
		console.log("[Fetcher Node] Initialized Parser and Duplicate Eliminator");

		let renderer: RendererAgent | null = null;
		if (config.useRenderer) {
			try {
				const r = new RendererAgent();
				await r.init();
				renderer = r;
				console.log("[Fetcher Node] Initialized Renderer Agent (Puppeteer)");
			} catch (err) {
				console.warn(
					"[Fetcher Node] Failed to initialize Renderer Agent — continuing without JavaScript rendering:",
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
		console.log(
			"[Fetcher Node] System running and listening for URLs in the queue.",
		);

		// Graceful shutdown
		process.on("SIGINT", async () => {
			console.log("[Fetcher Node] Shutting down...");
			if (renderer) {
				await renderer.close();
			}
			await frontier.close();
			await storage.close();
			process.exit(0);
		});
	} else {
		// Orchestrator mode (default)
		console.log(
			`[Orchestrator] Running in Orchestrator mode. Monitoring queue globally.`,
		);

		const queue = frontier.getQueue();

		// Listen for global completion events from the queue
		queue.on("global:completed", (_jobId, resultString) => {
			try {
				const result = JSON.parse(resultString);
				if (result?.success && result.url && result.podName) {
					console.log(
						`[Orchestrator] Pod [${result.podName}] successfully fetched: ${result.url}`,
					);
				}
			} catch (_e) {
				// Ignore non-json results
			}
		});

		console.log("[Orchestrator] System running and waiting for seeds.");

		// Graceful shutdown
		process.on("SIGINT", async () => {
			console.log("[Orchestrator] Shutting down...");
			await frontier.close();
			await storage.close();
			process.exit(0);
		});
	}
}

main().catch(console.error);
