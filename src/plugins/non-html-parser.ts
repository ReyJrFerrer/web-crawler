import { URL } from "node:url";
import * as cheerio from "cheerio";
import type { ParsedResult, ParserPlugin } from "../agents/parser";

export class NonHtmlParserPlugin implements ParserPlugin {
	name = "nonHtmlParser";

	// We only want to handle specific content types
	private handledTypes = [
		"application/json",
		"text/plain",
		"application/xml",
		"text/xml",
		"application/rss+xml",
		"application/atom+xml",
	];

	async parse(
		baseUrl: string,
		content: string | Buffer,
		originalDomain?: string,
		contentType?: string,
	): Promise<ParsedResult | undefined> {
		if (!contentType) return undefined; // Let default handler try if we don't know the type

		const isHandled = this.handledTypes.some(
			(type) => contentType === type || contentType.startsWith(`${type};`),
		);

		if (!isHandled) {
			return undefined; // Not a handled type, pass it on
		}

		console.log(`[NonHtmlParserPlugin] Handling ${contentType} for ${baseUrl}`);

		const contentStr =
			typeof content === "string" ? content : content.toString("utf-8");

		let title = baseUrl;
		let links: string[] = [];
		let text = "";

		try {
			if (contentType.includes("json")) {
				// Parse JSON to extract string values that look like URLs
				text = "JSON Data";
				links = this.extractUrlsFromText(contentStr, baseUrl, originalDomain);
			} else if (contentType.includes("xml")) {
				// Handle XML / Sitemaps / RSS
				const $ = cheerio.load(contentStr, { xmlMode: true });

				// Sitemaps use <loc>
				$("loc").each((_, el) => {
					const href = $(el).text();
					if (href) links.push(href);
				});

				// RSS/Atom uses <link> (text content or href attribute)
				$("link").each((_, el) => {
					const href = $(el).attr("href") || $(el).text();
					if (href) links.push(href);
				});

				title = $("title").first().text() || baseUrl;
				text = "XML Data";

				// Fallback to regex if no sitemap/rss tags found
				if (links.length === 0) {
					links = this.extractUrlsFromText(contentStr, baseUrl, originalDomain);
				}
			} else if (contentType.includes("text/plain")) {
				text = contentStr.substring(0, 1000); // just take a snippet as text
				links = this.extractUrlsFromText(contentStr, baseUrl, originalDomain);
			}

			// Clean up and filter links
			const uniqueLinks = Array.from(new Set(links))
				.map((link) => this.normalizeLink(link, baseUrl))
				.filter((link): link is string => link !== null)
				.filter((link) => {
					if (!originalDomain) return true;
					try {
						return new URL(link).hostname.endsWith(originalDomain);
					} catch {
						return false;
					}
				});

			return {
				url: baseUrl,
				title: title.substring(0, 200),
				links: uniqueLinks,
				text,
				contentType,
				extractedData: {
					method: "non-html-plugin",
					type: contentType,
				},
			};
		} catch (error) {
			console.error(`[NonHtmlParserPlugin] Error parsing ${baseUrl}:`, error);
			// Even if it failed, we return a fallback result so the default HTML parser doesn't mangle it
			return {
				url: baseUrl,
				title: baseUrl,
				links: [],
				text: "Parse Error",
				contentType,
			};
		}
	}

	private extractUrlsFromText(
		text: string,
		_baseUrl: string,
		_originalDomain?: string,
	): string[] {
		// A reasonable regex to find HTTP/HTTPS URLs in plain text or JSON
		const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
		const matches = text.match(urlRegex) || [];
		return Array.from(new Set(matches));
	}

	private normalizeLink(href: string, baseUrl: string): string | null {
		try {
			// Resolve relative URLs using baseUrl
			const urlObj = new URL(href, baseUrl);
			urlObj.hash = ""; // Remove fragment

			if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
				return null; // Skip non-web protocols
			}
			return urlObj.toString();
		} catch {
			return null;
		}
	}
}
