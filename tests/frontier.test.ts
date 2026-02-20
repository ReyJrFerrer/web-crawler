import { expect, test, describe, beforeAll, afterAll, mock } from "bun:test";
import { Frontier } from "../src/services/frontier";
import Queue from "bull";

mock.module("bull", () => {
  return {
    default: class MockQueue {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      async add(data: any) {
        return { data };
      }
      async close() {
        return true;
      }
    }
  };
});

describe("Frontier Service", () => {
  let frontier: Frontier;

  beforeAll(() => {
    frontier = new Frontier("test-queue");
  });

  afterAll(async () => {
    await frontier.close();
  });

  test("should add a URL to the queue", async () => {
    const job = await frontier.addUrl("http://example.com", 0);
    expect(job).toBeDefined();
    expect(job.data.url).toBe("http://example.com");
    expect(job.data.depth).toBe(0);
  });
});
