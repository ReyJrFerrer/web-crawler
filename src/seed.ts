import { parseArgs } from "node:util";
import { Frontier } from "./services/frontier";

async function main() {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			urls: { type: "string" },
		},
	});

	const urlsStr = values.urls;
	if (!urlsStr) {
		console.error(
			'Usage: bun run src/seed.ts --urls "http://example.com,http://example.org"',
		);
		process.exit(1);
	}

	const urls = urlsStr
		.split(",")
		.map((u) => u.trim())
		.filter((u) => u);
	const frontier = new Frontier();

	for (const url of urls) {
		let originalDomain: string | undefined;
		try {
			originalDomain = new URL(url).hostname;
		} catch (_e) {
			// ignore invalid URL at seed stage, let fetcher handle it
		}
		await frontier.addUrl(url, 0, originalDomain);
		console.log(`[Seed Injector] Injected: ${url}`);
	}

	await frontier.close();
	console.log("[Seed Injector] Done.");
}

main().catch(console.error);
