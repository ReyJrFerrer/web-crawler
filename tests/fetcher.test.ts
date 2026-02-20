import { expect, test, describe, beforeAll, mock } from "bun:test";
import { FetcherAgent } from "../src/agents/fetcher";

mock.module("axios", () => {
  return {
    default: {
      get: async (url: string) => ({
        data: "<html><body><a href='/1'>link 1</a><a href='http://other.com'>link 2</a></body></html>",
        status: 200
      })
    }
  };
});

class MockStorage {
  async saveRawHtml() { return { insertedId: "mock1" }; }
  async saveParsedData() { return { insertedId: "mock2" }; }
}

class MockFrontier {
  async addUrl() { return true; }
  getQueue() { return { process: () => {} }; }
}

class MockParser {
  parse() { return { title: "Test", links: ["http://example.com/1", "http://other.com/"] }; }
}

class MockEliminator {
  isNew(url: string) { return url === "http://example.com/1"; }
}

describe("Fetcher Agent with full pipeline", () => {
  let fetcher: FetcherAgent;

  beforeAll(() => {
    fetcher = new FetcherAgent(
      new MockFrontier() as any,
      new MockStorage() as any,
      new MockParser() as any,
      new MockEliminator() as any
    );
  });

  test("should fetch, parse and filter URLs", async () => {
    const success = await fetcher.fetchAndProcess("http://example.com", 0);
    expect(success).toBe(true);
  });
});
