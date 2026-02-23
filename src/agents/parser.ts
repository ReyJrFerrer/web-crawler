import * as cheerio from "cheerio";
import { config } from "../config";

export interface ParsedResult {
	url: string;
	title: string;
	links: string[];
	text: string;
	extractedData?: Record<string, unknown>;
}

export interface ParserPlugin {
	name: string;
	extract?(
		url: string,
		html: string,
		$: cheerio.CheerioAPI,
	):
		| Record<string, unknown>
		| Promise<Record<string, unknown> | undefined>
		| undefined;
	index?(result: ParsedResult): Promise<void> | void;
}

export class ParserAgent {
	private plugins: ParserPlugin[] = [];

	registerPlugin(plugin: ParserPlugin) {
		this.plugins.push(plugin);
	}

	async parse(
		baseUrl: string,
		html: string,
		originalDomain?: string,
	): Promise<ParsedResult> {
		const $ = cheerio.load(html);
		const title = $("title").text().trim() || "";

		const extractedData: Record<string, unknown> = {};
		for (const plugin of this.plugins) {
			if (plugin.extract) {
				try {
					const data = await plugin.extract(baseUrl, html, $);
					if (data) {
						extractedData[plugin.name] = data;
					}
				} catch (err) {
					console.error(
						`[ParserAgent] Plugin ${plugin.name} extract error:`,
						err,
					);
				}
			}
		}

		// Extract raw text for deduplication fingerprinting (SimHash)
		$("script, style, noscript, iframe").remove();
		const text = $("body").text().replace(/\s+/g, " ").trim();

		const links: Set<string> = new Set();
		let baseHostname = "";
		try {
			baseHostname = new URL(baseUrl).hostname;
		} catch (_e) {
			// invalid base url
			return { url: baseUrl, title, links: [], text: "", extractedData };
		}
		const effectiveOriginalDomain = originalDomain || baseHostname;
		const isExternalPage = baseHostname !== effectiveOriginalDomain;

		$("a[href]").each((_, el) => {
			const href = $(el).attr("href");
			if (href) {
				try {
					const urlObj = new URL(href, baseUrl);
					const absoluteUrl = urlObj.href;

					// Filter out javascript: or mailto: links
					if (!absoluteUrl.startsWith("http")) return;

					// Domain Restriction Filter
					if (config.domainFilter) {
						if (isExternalPage && urlObj.hostname !== effectiveOriginalDomain) {
							return;
						}
					}

					// Spider Trap Protector: URL depth limits
					const pathSegments = urlObj.pathname.split("/").filter(Boolean);
					if (pathSegments.length > config.maxDepth) return;

					// Spider Trap Protector: Path-repetition detection algorithm
					// Detects if a sequence of one or more path segments repeats consecutively
					// e.g., /calendar/2026/01/01/calendar/2026/01/01
					const str = urlObj.pathname;
					// Repeated single directory 3 times? e.g. /a/a/a
					const singleRepeat = /(\/[^/]+)\1\1/i.test(str);
					// Repeated multiple directories 2 times? e.g. /a/b/a/b
					const multiRepeat = /((\/[^/]+){2,})\1/i.test(str);

					if (singleRepeat || multiRepeat) return;

					links.add(absoluteUrl);
				} catch (_e) {
					// invalid url, ignore
				}
			}
		});

		const result: ParsedResult = {
			url: baseUrl,
			title,
			links: Array.from(links),
			text,
			extractedData,
		};

		// Run indexers
		for (const plugin of this.plugins) {
			if (plugin.index) {
				try {
					await plugin.index(result);
				} catch (err) {
					console.error(
						`[ParserAgent] Plugin ${plugin.name} index error:`,
						err,
					);
				}
			}
		}

		return result;
	}
}
