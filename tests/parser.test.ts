import { expect, test, describe } from "bun:test";
import { ParserAgent } from "../src/agents/parser";

describe("Parser Agent", () => {
  const parser = new ParserAgent();

  test("should extract title and links from HTML", () => {
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
    expect(result.links.length).toBe(3);
    expect(result.links).toContain("https://example.com/about");
    expect(result.links).toContain("https://other.com/page");
    expect(result.links).toContain("https://example.com/invalid");
  });

  test("should handle missing title gracefully", () => {
    const html = `<html><body><p>No title</p></body></html>`;
    const result = parser.parse("https://example.com", html);
    expect(result.title).toBe("");
    expect(result.links.length).toBe(0);
  });
});
