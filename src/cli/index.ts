import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import prompts from "prompts";
import { DecompressorService } from "../services/decompressor";
import { Frontier } from "../services/frontier";

const NAMESPACE = "default";
const DEPLOYMENT_NAME = "crawler-fetcher";

async function getK8sApi() {
	const kc = new KubeConfig();
	try {
		kc.loadFromDefault();
		// Workaround for local dev environments with self-signed certs (e.g., Docker Desktop)
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		return {
			appsApi: kc.makeApiClient(AppsV1Api),
			coreApi: kc.makeApiClient(CoreV1Api),
		};
	} catch (_e) {
		return null;
	}
}

async function viewFetchers() {
	const apis = await getK8sApi();
	if (!apis) {
		console.log(
			"❌ Could not connect to Kubernetes API. Are you sure you have a valid kubeconfig?",
		);
		return;
	}

	try {
		const res = await apis.coreApi.listNamespacedPod({
			namespace: NAMESPACE,
			labelSelector: `app=${DEPLOYMENT_NAME}`,
		});

		const pods = res.items;
		console.log(`\n📦 Active Fetcher Pods (${pods.length}):\n`);

		if (pods.length === 0) {
			console.log("  No fetcher pods found. Use the Scale menu to add some.");
		} else {
			for (const pod of pods) {
				const status = pod.status?.phase || "Unknown";
				const restarts = pod.status?.containerStatuses?.[0]?.restartCount || 0;
				const ready = pod.status?.containerStatuses?.[0]?.ready
					? "Ready"
					: "Not Ready";
				console.log(
					`  - ${pod.metadata?.name} | Status: ${status} (${ready}) | Restarts: ${restarts}`,
				);
			}
		}
		console.log("\n");
	} catch (e) {
		console.log(`❌ Failed to list pods: ${(e as Error).message}`);
	}
}

async function scaleFetchers() {
	const apis = await getK8sApi();
	if (!apis) {
		console.log("❌ Could not connect to Kubernetes API.");
		return;
	}

	let currentScale = 0;
	try {
		const res = await apis.appsApi.readNamespacedDeployment({
			name: DEPLOYMENT_NAME,
			namespace: NAMESPACE,
		});
		currentScale = res.spec?.replicas || 0;
	} catch (_error) {
		console.error(
			`❌ Deployment '${DEPLOYMENT_NAME}' not found or inaccessible.`,
		);
		return;
	}

	const response = await prompts({
		type: "number",
		name: "replicas",
		message: `Enter fetcher replicas to scale to (Current: ${currentScale}):`,
		initial: currentScale,
		min: 0,
		max: 50,
	});

	if (response.replicas === undefined) return;

	try {
		console.log(
			`Scaling '${DEPLOYMENT_NAME}' to ${response.replicas} replicas...`,
		);

		const deployment = await apis.appsApi.readNamespacedDeployment({
			name: DEPLOYMENT_NAME,
			namespace: NAMESPACE,
		});

		if (deployment.spec) {
			deployment.spec.replicas = response.replicas;

			await apis.appsApi.replaceNamespacedDeployment({
				name: DEPLOYMENT_NAME,
				namespace: NAMESPACE,
				body: deployment,
			});

			console.log(`✅ Scaled successfully to ${response.replicas} replicas.\n`);
		} else {
			console.error("❌ Failed to scale: Deployment spec is missing.");
		}
	} catch (error) {
		console.error("❌ Failed to scale:", (error as Error).message);
	}
}

async function monitorQueue(frontier: Frontier) {
	console.log("\n📊 Live Queue Monitor (Reading from Redis...)");
	try {
		const queue = frontier.getQueue();
		const counts = await queue.getJobCounts();

		console.log(`  ⏳ Waiting (Frontier):   ${counts.waiting}`);
		console.log(`  🚀 Active (Fetching):    ${counts.active}`);
		console.log(`  ✅ Completed (Success):  ${counts.completed}`);
		console.log(`  ❌ Failed (Dead-Letter): ${counts.failed}`);
		console.log(`  ⏸️  Delayed (Retries):    ${counts.delayed}`);
		console.log("\n");
	} catch (error) {
		console.error("❌ Failed to read queue stats:", error);
	}
}

async function controlPanel(frontier: Frontier) {
	const response = await prompts({
		type: "select",
		name: "action",
		message: "Queue Control Panel",
		choices: [
			{ title: "⏸️  Pause Queue", value: "pause" },
			{ title: "▶️  Resume Queue", value: "resume" },
			{ title: "🗑️  Empty Queue (Clear all URLs)", value: "empty" },
			{ title: "🛑  Stop Crawl", value: "stop" },
			{ title: "Go Back", value: "back" },
		],
	});

	try {
		switch (response.action) {
			case "pause":
				await frontier.pause(false);
				console.log(
					"✅ Queue paused. Pause signal sent to fetchers to abort active jobs.\n",
				);
				break;
			case "resume":
				await frontier.resume(false);
				console.log("✅ Queue resumed. Fetchers will continue pulling URLs.\n");
				break;
			case "empty":
				await frontier.empty();
				console.log(
					"✅ Queue emptied. Empty signal sent to all fetchers to abort active jobs.\n",
				);
				break;
			case "stop":
				await frontier.stop();
				console.log(
					"✅ Crawl fully stopped and queue cleared. Stop signal sent to all fetchers.\n",
				);
				break;
			case "back":
			case undefined:
				console.log("\n");
				break;
		}
	} catch (error) {
		console.error("❌ Error performing action:", error);
	}
}

async function decompressHTML() {
	const decompressor = new DecompressorService();
	await decompressor.runCli();
}

async function main() {
	console.log("🕸️ Scalable Web Crawler - Unified CLI Dashboard\n");
	const frontier = new Frontier();

	let exit = false;
	while (!exit) {
		const response = await prompts({
			type: "select",
			name: "menu",
			message: "Main Menu",
			choices: [
				{ title: "👀 View Active Kubernetes Fetchers", value: "view" },
				{ title: "⚖️  Scale Kubernetes Fetchers", value: "scale" },
				{ title: "📊 Monitor Queue Stats", value: "monitor" },
				{ title: "🎛️  Queue Control Panel (Pause/Clear)", value: "control" },
				{ title: "📦 Decompress/View HTML Storage", value: "decompress" },
				{ title: "🚪 Exit", value: "exit" },
			],
		});

		switch (response.menu) {
			case "view":
				await viewFetchers();
				break;
			case "scale":
				await scaleFetchers();
				break;
			case "monitor":
				await monitorQueue(frontier);
				break;
			case "control":
				await controlPanel(frontier);
				break;
			case "decompress":
				await decompressHTML();
				break;
			case "exit":
			case undefined:
				exit = true;
				break;
		}
	}

	console.log("Goodbye!");
	await frontier.close();
	process.exit(0);
}

main().catch(console.error);
