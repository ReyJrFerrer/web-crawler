import { describe, expect, test } from "bun:test";
import { ProxyManager } from "../src/utils/proxy-manager";

describe("Proxy Manager", () => {
	test("should rotate proxies and handle failures", async () => {
		const manager = new ProxyManager();
		manager._setProxies([
			{
				protocol: "http",
				host: "1.1.1.1",
				port: 8080,
				failures: 0,
				bannedUntil: 0,
			},
			{
				protocol: "http",
				host: "2.2.2.2",
				port: 8080,
				failures: 0,
				bannedUntil: 0,
			},
		]);

		// Force it to use the list we set by faking a config url
		const originalConfig = require("../src/config").config;
		originalConfig.proxyListUrl = "http://fake.com";

		const p1 = await manager.getProxy();
		expect(p1?.host).toBe("1.1.1.1");

		const p2 = await manager.getProxy();
		expect(p2?.host).toBe("2.2.2.2");

		// Report failures for p1
		if (p1) {
			manager.reportFailure(p1);
			manager.reportFailure(p1);
			manager.reportFailure(p1); // 3rd failure should ban
		}

		// p1 is banned, it should return p2
		const p3 = await manager.getProxy();
		expect(p3?.host).toBe("2.2.2.2");

		// Ban p2
		if (p2) {
			manager.reportFailure(p2);
			manager.reportFailure(p2);
			manager.reportFailure(p2);
		}

		// All banned
		const p4 = await manager.getProxy();
		expect(p4).toBeUndefined();
	});
});
