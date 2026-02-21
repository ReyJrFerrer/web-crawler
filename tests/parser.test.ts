import { expect, test, describe } from "bun:test";
import { ParserAgent } from "../src/agents/parser";

describe("Parser Agent", () => {
  const parser = new ParserAgent();

  test("should extract title and links from HTML, respecting domain restriction", () => {
    const html = `
      <html>
        <head><title>Test Title</title></head>
        <body>
          <a href="/about">About</a>
          <a href="https://other.com/page">Other</a>
          <a href="invalid">Invalid</a>
        </body>
      </html>
    `;
    const baseUrl = "https://example.com/home";
    const result = parser.parse(baseUrl, html);

    expect(result.title).toBe("Test Title");
    // Should drop "https://other.com/page" due to domain restriction
    expect(result.links.length).toBe(2);
    expect(result.links).toContain("https://example.com/about");
    expect(result.links).toContain("https://example.com/invalid");
  });

  test("should handle missing title gracefully", () => {
    const html = `<html><body><p>No title</p></body></html>`;
    const result = parser.parse("https://example.com", html);
    expect(result.title).toBe("");
    expect(result.links.length).toBe(0);
  });

  test("should detect and drop spider traps (path repetition)", () => {
    const html = `
      <html>
        <body>
          <a href="/calendar/2026/01/01/calendar/2026/01/01">Repeated Path</a>
          <a href="/normal/page">Normal Page</a>
        </body>
      </html>
    `;
    const baseUrl = "https://example.com/";
    const result = parser.parse(baseUrl, html);

    expect(result.links).not.toContain("https://example.com/calendar/2026/01/01/calendar/2026/01/01");
    expect(result.links).toContain("https://example.com/normal/page");
  });
  
  test("should check url depth limits", () => {
    // MAX_DEPTH is 5
    // If a url has more than 5 path segments, it might be considered too deep.
    // Or depth tracking could be the queue depth? 
    // "URL depth limits and Path-repetition detection algorithm"
    const html = `
      <html>
        <body>
          <a href="/1/2/3/4/5/6">Too Deep</a>
          <a href="/1/2/3">Not Too Deep</a>
        </body>
      </html>
    `;
    const baseUrl = "https://example.com/";
    const result = parser.parse(baseUrl, html);

    expect(result.links).not.toContain("https://example.com/1/2/3/4/5/6");
    expect(result.links).toContain("https://example.com/1/2/3");
  });
});
