import http from "node:http";
import https from "node:https";

// We wrap the import of cacheable-lookup in a try-catch and only use it
// if the current JS runtime supports intercepting http.Agent.createConnection
// (Bun doesn't support this internally yet, but Node does).

export const httpAgent = new http.Agent({ keepAlive: true });
export const httpsAgent = new https.Agent({ keepAlive: true });

try {
	// Dynamically require so we can gracefully fail
	const CacheableLookup = require("cacheable-lookup");
	const cacheable = new CacheableLookup();

	if (
		typeof (httpAgent as http.Agent & { createConnection?: unknown })
			.createConnection === "function"
	) {
		cacheable.install(httpAgent);
		cacheable.install(httpsAgent);
		console.log("[DNS Cache] Initialized and attached to HTTP/HTTPS agents");
	} else {
		console.log(
			"[DNS Cache] Skipped installing cacheable-lookup (Runtime unsupported)",
		);
	}
} catch (_err) {
	console.log(
		"[DNS Cache] Skipped installing cacheable-lookup (Runtime unsupported)",
	);
}
