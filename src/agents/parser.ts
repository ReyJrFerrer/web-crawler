import * as cheerio from "cheerio";

export interface ParsedResult {
	title: string;
	links: string[];
}

export class ParserAgent {
	parse(baseUrl: string, html: string): ParsedResult {
		const $ = cheerio.load(html);
		const title = $("title").text().trim() || "";
		const links: Set<string> = new Set();

		$("a[href]").each((_, el) => {
			const href = $(el).attr("href");
			if (href) {
				try {
					const absoluteUrl = new URL(href, baseUrl).href;
					// Filter out javascript: or mailto: links
					if (absoluteUrl.startsWith("http")) {
						links.add(absoluteUrl);
					}
				} catch (_e) {
					// invalid url, ignore
				}
			}
		});

		return {
			title,
			links: Array.from(links),
		};
	}
}
