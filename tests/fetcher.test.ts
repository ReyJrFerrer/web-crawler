import { beforeAll, describe, expect, mock, test } from "bun:test";
import { FetcherAgent } from "../src/agents/fetcher";
import { config } from "../src/config";
import { proxyManager } from "../src/utils/proxy-manager";

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
				if (url === "http://forbidden.com") {
					return {
						status: 403,
						data: "Forbidden",
					};
				}
				if (url === "http://too-many-requests.com") {
					return {
						status: 429,
						data: "Too Many Requests",
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
	saveParsedDataMock = mock((url, data) => ({ insertedId: "mock2" }));
	async saveRawHtml() {
		return { insertedId: "mock1" };
	}
	async saveParsedData(url: string, data: any) {
		return this.saveParsedDataMock(url, data);
	}
}

class MockFrontier {
	async addUrl() {
		return true;
	}
	getQueue() {
		return { process: () => {} };
	}
	async isStopped() {
		return false;
	}
	async isPaused() {
		return false;
	}
}

class MockParser {
	parse(_url: string, html: string) {
		if (html.includes("RENDERED_SPA")) {
			return {
				title: "SPA Test",
				links: ["http://spa.com/page2"],
				text: "rendered content",
				extractedData: { isSPA: true },
			};
		}
		return {
			title: "Test",
			links: ["http://example.com/1", "http://other.com/"],
			text: "normal content",
			extractedData: { isNormal: true },
		};
	}
}

class MockEliminator {
	isNew(_url: string) {
		return true;
	}
	isDuplicateContent(_text: string) {
		return false;
	}
}

class MockRenderer {
	async render(_url: string) {
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
		const mockStorage = (fetcher as any).storage as MockStorage;
		expect(mockStorage.saveParsedDataMock).toHaveBeenCalledWith(
			"http://example.com",
			expect.objectContaining({ extractedData: { isNormal: true } }),
		);
	});

	test("should detect and render SPA URLs", async () => {
		const success = await fetcher.fetchAndProcess("http://spa.com", 0);
		expect(success).toBe(true);
		const mockStorage = (fetcher as any).storage as MockStorage;
		expect(mockStorage.saveParsedDataMock).toHaveBeenCalledWith(
			"http://spa.com",
			expect.objectContaining({ extractedData: { isSPA: true } }),
		);
	});

	test("should return false on 403 to trigger Dead Letter Queue retry flow and report proxy failure", async () => {
		config.proxyListUrl = "http://mock";
		proxyManager._setProxies([
			{
				protocol: "http",
				host: "1.2.3.4",
				port: 8080,
				failures: 0,
				bannedUntil: 0,
			},
		]);

		const proxyBefore = await proxyManager.getProxy();
		expect(proxyBefore?.failures).toBe(0);

		const success = await fetcher.fetchAndProcess("http://forbidden.com", 0);
		expect(success).toBe(false);

		const proxyAfter = await proxyManager.getProxy();
		expect(proxyAfter?.failures).toBe(1);

		proxyManager._setProxies([]);
		config.proxyListUrl = "";
	});

	test("should return false on 429 to trigger Dead Letter Queue retry flow", async () => {
		const success = await fetcher.fetchAndProcess(
			"http://too-many-requests.com",
			0,
		);
		expect(success).toBe(false);
	});
});
