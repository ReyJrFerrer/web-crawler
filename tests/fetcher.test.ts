import { beforeAll, describe, expect, mock, test } from "bun:test";
import { FetcherAgent } from "../src/agents/fetcher";
import { config } from "../src/config";

mock.module("axios", () => {
	return {
		default: {
			get: async (url: string) => {
				if (url === "http://spa.com") {
					return {
						data: '<html><head></head><body><div id="root"></div><script>load()</script></body></html>',
						status: 200,
					};
				}
				return {
					data: "<html><body><a href='/1'>link 1</a><a href='http://other.com'>link 2</a></body></html>",
					status: 200,
				};
			},
		},
	};
});

class MockStorage {
	async saveRawHtml() {
		return { insertedId: "mock1" };
	}
	async saveParsedData() {
		return { insertedId: "mock2" };
	}
}

class MockFrontier {
	async addUrl() {
		return true;
	}
	getQueue() {
		return { process: () => {} };
	}
}

class MockParser {
	parse(url: string, html: string) {
		if (html.includes("RENDERED_SPA")) {
			return { title: "SPA Test", links: ["http://spa.com/page2"] };
		}
		return {
			title: "Test",
			links: ["http://example.com/1", "http://other.com/"],
		};
	}
}

class MockEliminator {
	isNew(url: string) {
		return true;
	}
}

class MockRenderer {
	async render(url: string) {
		return "<html><body><div id='root'>RENDERED_SPA</div></body></html>";
	}
}

describe("Fetcher Agent with full pipeline", () => {
	let fetcher: FetcherAgent;

	beforeAll(() => {
		config.useRenderer = true; // ensure renderer is enabled for testing
		fetcher = new FetcherAgent(
			new MockFrontier() as any,
			new MockStorage() as any,
			new MockParser() as any,
			new MockEliminator() as any,
			new MockRenderer() as any,
		);
	});

	test("should fetch, parse and filter URLs", async () => {
		const success = await fetcher.fetchAndProcess("http://example.com", 0);
		expect(success).toBe(true);
	});

	test("should detect and render SPA URLs", async () => {
		const success = await fetcher.fetchAndProcess("http://spa.com", 0);
		expect(success).toBe(true);
	});
});
