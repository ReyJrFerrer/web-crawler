import { AppsV1Api, KubeConfig } from "@kubernetes/client-node";
import * as prompts from "prompts";

async function main() {
	console.log("🕸️ Crawler CLI - Cluster Management");
	const kc = new KubeConfig();
	kc.loadFromDefault(); // Loads ~/.kube/config

	const k8sApi = kc.makeApiClient(AppsV1Api);
	const namespace = "default";
	const deploymentName = "crawler-fetcher";

	// Check if deployment exists and get current scale
	let currentScale = 0;
	try {
		const res = await k8sApi.readNamespacedDeploymentScale({
			name: deploymentName,
			namespace: namespace,
		});
		currentScale = res.spec?.replicas || 0;
		console.log(`Current replicas for '${deploymentName}': ${currentScale}`);
	} catch (_error) {
		console.error(
			`❌ Deployment '${deploymentName}' not found in namespace '${namespace}' or cannot be accessed.`,
		);
		process.exit(1);
	}

	const response = await prompts.default({
		type: "number",
		name: "replicas",
		message: "Enter the number of fetcher replicas to scale to:",
		initial: currentScale,
		min: 0,
		max: 50,
	});

	if (response.replicas === undefined) {
		console.log("Operation cancelled.");
		process.exit(0);
	}

	const replicas = response.replicas;

	try {
		console.log(`Scaling '${deploymentName}' to ${replicas} replicas...`);
		await k8sApi.replaceNamespacedDeploymentScale({
			name: deploymentName,
			namespace: namespace,
			body: {
				metadata: { name: deploymentName, namespace },
				spec: { replicas },
			},
		});
		console.log(`✅ Successfully initiated scaling to ${replicas} replicas.`);
	} catch (error) {
		console.error("❌ Failed to scale deployment:", (error as Error).message);
	}
}

main().catch(console.error);
