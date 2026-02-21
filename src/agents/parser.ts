import * as cheerio from "cheerio";
import { config } from "../config";

export interface ParsedResult {
	title: string;
	links: string[];
	text: string;
}

export class ParserAgent {
	parse(baseUrl: string, html: string, originalDomain?: string): ParsedResult {
		const $ = cheerio.load(html);
		const title = $("title").text().trim() || "";
		// Extract raw text for deduplication fingerprinting (SimHash)
		$("script, style, noscript, iframe").remove();
		const text = $("body").text().replace(/\s+/g, " ").trim();

		const links: Set<string> = new Set();
		let baseHostname = "";
		try {
			baseHostname = new URL(baseUrl).hostname;
		} catch (_e) {
			// invalid base url
			return { title, links: [], text: "" };
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
							// If we are on an external page (e.g. youtube.com embedded link),
							// restrict fetching unrelated contents (e.g. other youtube.com links)
							return;
						}
						// If we are NOT on an external page, we allow all links (so we can scrape embedded external links)
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

		return {
			title,
			links: Array.from(links),
			text,
		};
	}
}
