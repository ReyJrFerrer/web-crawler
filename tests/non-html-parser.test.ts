import { describe, expect, it } from "bun:test";
import { NonHtmlParserPlugin } from "../src/plugins/non-html-parser";

describe("NonHtmlParserPlugin", () => {
	const plugin = new NonHtmlParserPlugin();

	it("should parse JSON containing URLs", async () => {
		const jsonContent = JSON.stringify({
			items: [
				{ url: "https://example.com/item1" },
				{ link: "http://example.org/item2" },
				{ text: "not a url" },
			],
		});

		const result = await plugin.parse(
			"https://api.example.com/data.json",
			jsonContent,
			undefined,
			"application/json; charset=utf-8",
		);

		expect(result).toBeDefined();
		expect(result?.contentType).toContain("json");
		expect(result?.links).toContain("https://example.com/item1");
		expect(result?.links).toContain("http://example.org/item2");
		expect(result?.links).not.toContain("not a url");
		expect(result?.links.length).toBe(2);
	});

	it("should parse plain text containing URLs", async () => {
		const textContent = `
			Here are some links:
			- https://test.com/a
			- http://test.com/b
			And some other text without links.
		`;

		const result = await plugin.parse(
			"https://example.com/text.txt",
			textContent,
			undefined,
			"text/plain",
		);

		expect(result).toBeDefined();
		expect(result?.links).toContain("https://test.com/a");
		expect(result?.links).toContain("http://test.com/b");
		expect(result?.links.length).toBe(2);
	});

	it("should parse XML Sitemaps", async () => {
		const xmlContent = `
			<?xml version="1.0" encoding="UTF-8"?>
			<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
				<url>
					<loc>https://example.com/page1.html</loc>
					<lastmod>2023-01-01</lastmod>
				</url>
				<url>
					<loc>https://example.com/page2.html</loc>
				</url>
			</urlset>
		`;

		const result = await plugin.parse(
			"https://example.com/sitemap.xml",
			xmlContent,
			"example.com",
			"application/xml",
		);

		expect(result).toBeDefined();
		expect(result?.links).toContain("https://example.com/page1.html");
		expect(result?.links).toContain("https://example.com/page2.html");
		expect(result?.links.length).toBe(2);
	});

	it("should filter external links if originalDomain is provided", async () => {
		const textContent = `
			Link 1: https://target.com/page
			Link 2: https://external.com/page
		`;

		const result = await plugin.parse(
			"https://target.com/file.txt",
			textContent,
			"target.com",
			"text/plain",
		);

		expect(result).toBeDefined();
		expect(result?.links).toContain("https://target.com/page");
		expect(result?.links).not.toContain("https://external.com/page");
		expect(result?.links.length).toBe(1);
	});

	it("should return undefined for unhandled content types", async () => {
		const htmlContent =
			"<html><body><a href='https://example.com'>link</a></body></html>";

		const result = await plugin.parse(
			"https://example.com/page.html",
			htmlContent,
			"example.com",
			"text/html",
		);

		expect(result).toBeUndefined();
	});
});
