import axios from "axios";
import { config } from "../config";

export interface ProxyConfig {
	protocol: string;
	host: string;
	port: number;
	failures: number;
	bannedUntil: number;
}

export class ProxyManager {
	private proxies: ProxyConfig[] = [];
	private currentIndex = 0;
	private lastFetchTime = 0;
	private readonly fetchInterval = 60 * 60 * 1000; // Refresh every hour
	private readonly maxFailures = 3;
	private readonly banDuration = 5 * 60 * 1000; // 5 minutes

	async getProxy(): Promise<ProxyConfig | undefined> {
		if (!config.proxyListUrl) {
			return undefined;
		}

		await this.refreshProxiesIfNeeded();

		if (this.proxies.length === 0) {
			return undefined;
		}

		const now = Date.now();
		// Find the next available unbanned proxy
		let attempts = 0;
		while (attempts < this.proxies.length) {
			const proxy = this.proxies[this.currentIndex];
			this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

			if (proxy && proxy.bannedUntil < now) {
				return proxy;
			}
			attempts++;
		}

		console.warn(
			"[ProxyManager] All proxies are currently banned. Falling back to direct connection.",
		);
		return undefined;
	}

	private async refreshProxiesIfNeeded(): Promise<void> {
		const now = Date.now();
		if (
			this.proxies.length === 0 ||
			now - this.lastFetchTime > this.fetchInterval
		) {
			try {
				const response = await axios.get(config.proxyListUrl, {
					timeout: 5000,
				});

				const lines =
					typeof response.data === "string"
						? response.data.split("\n")
						: Array.isArray(response.data)
							? response.data
							: [];

				const newProxies: ProxyConfig[] = [];
				for (let line of lines) {
					line = line.trim();
					if (!line) continue;
					try {
						const hasProtocol = line.includes("://");
						const urlString = hasProtocol ? line : `http://${line}`;
						const url = new URL(urlString);

						// Preserve state if proxy already exists
						const existing = this.proxies.find(
							(p) =>
								p.host === url.hostname &&
								p.port ===
									parseInt(
										url.port || (url.protocol === "https:" ? "443" : "80"),
										10,
									),
						);

						newProxies.push({
							protocol: url.protocol.replace(":", ""),
							host: url.hostname,
							port: parseInt(
								url.port || (url.protocol === "https:" ? "443" : "80"),
								10,
							),
							failures: existing ? existing.failures : 0,
							bannedUntil: existing ? existing.bannedUntil : 0,
						});
					} catch (_e) {
						// ignore invalid lines
					}
				}

				if (newProxies.length > 0) {
					this.proxies = newProxies;
					this.lastFetchTime = now;
					console.log(
						`[ProxyManager] Loaded/Refreshed ${this.proxies.length} proxies.`,
					);
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(
					`[ProxyManager] Failed to fetch proxy list: ${errorMessage}`,
				);
			}
		}
	}

	reportFailure(proxy: ProxyConfig) {
		proxy.failures += 1;
		if (proxy.failures >= this.maxFailures) {
			proxy.bannedUntil = Date.now() + this.banDuration;
			console.log(
				`[ProxyManager] Banning proxy ${proxy.host}:${proxy.port} for ${this.banDuration / 1000}s due to ${proxy.failures} consecutive failures.`,
			);
			proxy.failures = 0; // Reset failures for when it comes back
		}
	}

	reportSuccess(proxy: ProxyConfig) {
		proxy.failures = 0;
		proxy.bannedUntil = 0;
	}

	// Expose for testing
	_setProxies(proxies: ProxyConfig[]) {
		this.proxies = proxies;
		this.lastFetchTime = Date.now();
	}
}

export const proxyManager = new ProxyManager();
