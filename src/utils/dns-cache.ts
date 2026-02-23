import http from "node:http";
import https from "node:https";

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
