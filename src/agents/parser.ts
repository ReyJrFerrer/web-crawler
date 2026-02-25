import * as cheerio from "cheerio";
import { config } from "../config";

export interface ParsedResult {
	url: string;
	title: string;
	links: string[];
	text: string;
	extractedData?: Record<string, unknown>;
	contentType?: string;
}

export interface ParserPlugin {
	name: string;
	// Main entry point for overriding the entire parse process
	parse?(
		baseUrl: string,
		content: string | Buffer,
		originalDomain?: string,
		contentType?: string,
	): Promise<ParsedResult | undefined> | undefined;

	// Legacy hook for extending HTML parsing
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
		content: string | Buffer,
		originalDomain?: string,
		contentType?: string,
	): Promise<ParsedResult> {
		// 1. Give plugins a chance to handle the parsing completely (e.g. for non-HTML)
		for (const plugin of this.plugins) {
			if (plugin.parse) {
				try {
					const result = await plugin.parse(
						baseUrl,
						content,
						originalDomain,
						contentType,
					);
					if (result) {
						// Run indexers
						for (const indexPlugin of this.plugins) {
							if (indexPlugin.index) {
								try {
									await indexPlugin.index(result);
								} catch (err) {
									console.error(
										`[ParserAgent] Plugin ${indexPlugin.name} index error:`,
										err,
									);
								}
							}
						}
						return result;
					}
				} catch (err) {
					console.error(
						`[ParserAgent] Plugin ${plugin.name} parse error:`,
						err,
					);
				}
			}
		}

		// Ensure content is string for HTML parsing
		const html =
			typeof content === "string" ? content : content.toString("utf-8");

		// 2. Fallback to default HTML parsing if no plugin handled it
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
			return {
				url: baseUrl,
				title,
				links: [],
				text: "",
				extractedData,
				contentType,
			};
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
			contentType,
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
