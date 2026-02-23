import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ParserAgent, type ParserPlugin } from "../src/agents/parser";
import { config } from "../src/config";

describe("Parser Agent", () => {
	const parser = new ParserAgent();
	let originalDomainFilter: boolean;

	beforeAll(() => {
		originalDomainFilter = config.domainFilter;
		config.domainFilter = true; // force true for testing
	});

	afterAll(() => {
		config.domainFilter = originalDomainFilter;
	});

	test("should extract title and links from HTML, respecting domain restriction", async () => {
		// 1. Scraping from seed domain (allows external link like other.com)
		const html1 = `
      <html>
        <head><title>Test Title</title></head>
        <body>
          <a href="/about">About</a>
          <a href="https://other.com/page">Other</a>
          <a href="invalid">Invalid</a>
        </body>
      </html>
    `;
		const baseUrl1 = "https://example.com/home";
		const result1 = await parser.parse(baseUrl1, html1, "example.com");

		expect(result1.title).toBe("Test Title");
		// Should NOT drop "https://other.com/page" because we allow scraping embedded links
		expect(result1.links.length).toBe(3);
		expect(result1.links).toContain("https://example.com/about");
		expect(result1.links).toContain("https://example.com/invalid");
		expect(result1.links).toContain("https://other.com/page");

		// 2. Scraping from external domain (should restrict further external links)
		const html2 = `
      <html>
        <body>
          <a href="/about">About (Internal to other.com)</a>
          <a href="https://yetanother.com/page">Yet Another</a>
          <a href="https://example.com/back">Back to Seed</a>
        </body>
      </html>
    `;
		const baseUrl2 = "https://other.com/page";
		const result2 = await parser.parse(baseUrl2, html2, "example.com");

		// If config has domainFilter true, we restrict:
		// "https://other.com/about" -> urlObj.hostname = "other.com" !== "example.com". Dropped!
		// "https://yetanother.com/page" -> hostname = "yetanother.com" !== "example.com". Dropped!
		// "https://example.com/back" -> hostname = "example.com" === "example.com". Kept!

		expect(result2.links.length).toBe(1);
		expect(result2.links).toContain("https://example.com/back");
		expect(result2.links).not.toContain("https://other.com/about");
		expect(result2.links).not.toContain("https://yetanother.com/page");
	});

	test("should handle missing title gracefully", async () => {
		const html = `<html><body><p>No title</p></body></html>`;
		const result = await parser.parse("https://example.com", html);
		expect(result.title).toBe("");
		expect(result.links.length).toBe(0);
	});

	test("should detect and drop spider traps (path repetition)", async () => {
		const html = `
      <html>
        <body>
          <a href="/calendar/2026/01/01/calendar/2026/01/01">Repeated Path</a>
          <a href="/normal/page">Normal Page</a>
        </body>
      </html>
    `;
		const baseUrl = "https://example.com/";
		const result = await parser.parse(baseUrl, html);

		expect(result.links).not.toContain(
			"https://example.com/calendar/2026/01/01/calendar/2026/01/01",
		);
		expect(result.links).toContain("https://example.com/normal/page");
	});

	test("should check url depth limits", async () => {
		const html = `
      <html>
        <body>
          <a href="/1/2/3/4/5/6">Too Deep</a>
          <a href="/1/2/3">Not Too Deep</a>
        </body>
      </html>
    `;
		const baseUrl = "https://example.com/";
		const result = await parser.parse(baseUrl, html);

		expect(result.links).not.toContain("https://example.com/1/2/3/4/5/6");
		expect(result.links).toContain("https://example.com/1/2/3");
	});

	test("should extract text for deduplication fingerprinting", async () => {
		const html = `
      <html>
        <head><title>Title</title></head>
        <body>
          <h1>Heading</h1>
          <p>Some paragraph text.</p>
          <script>console.log("ignore me")</script>
          <style>.ignore { display: none; }</style>
        </body>
      </html>
    `;
		const baseUrl = "https://example.com/";
		const result = await parser.parse(baseUrl, html);

		expect(result.text).toBe("Heading Some paragraph text.");
	});

	test("should support extensibility layer with custom plugins", async () => {
		const pluginParser = new ParserAgent();

		let indexCalled = false;
		let indexedData: any = null;

		const imageExtractorPlugin: ParserPlugin = {
			name: "imageExtractor",
			extract: (_url, _html, $) => {
				const images: string[] = [];
				$("img").each((_, el) => {
					const src = $(el).attr("src");
					if (src) images.push(src);
				});
				return { count: images.length, images };
			},
			index: (result) => {
				indexCalled = true;
				indexedData = result;
			},
		};

		pluginParser.registerPlugin(imageExtractorPlugin);

		const html = `
      <html>
        <head><title>Plugin Test</title></head>
        <body>
          <img src="pic1.png" />
          <img src="pic2.jpg" />
        </body>
      </html>
    `;
		const baseUrl = "https://example.com/";
		const result = await pluginParser.parse(baseUrl, html);

		const extractedData = result.extractedData as any;
		expect(extractedData?.imageExtractor).toBeDefined();
		expect(extractedData?.imageExtractor.count).toBe(2);
		expect(extractedData?.imageExtractor.images).toContain("pic1.png");

		expect(indexCalled).toBe(true);
		expect(indexedData.title).toBe("Plugin Test");
	});
});
