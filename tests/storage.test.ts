import { expect, test, describe, beforeAll, afterAll, mock } from "bun:test";
import { StorageService } from "../src/services/storage";
import { MongoClient } from "mongodb";

// Mock MongoDB
mock.module("mongodb", () => {
  return {
    MongoClient: class MockMongoClient {
      async connect() { return this; }
      db(name: string) {
        return {
          collection(name: string) {
            return {
              insertOne: async (doc: any) => ({ insertedId: "mockId" }),
              findOne: async (query: any) => null
            };
          }
        };
      }
      async close() {}
    }
  };
});

describe("Storage Service", () => {
  let storage: StorageService;

  beforeAll(async () => {
    storage = new StorageService();
    await storage.connect();
  });

  afterAll(async () => {
    await storage.close();
  });

  test("should store raw HTML", async () => {
    const result = await storage.saveRawHtml("http://example.com", "<html><body>test</body></html>");
    expect(result.insertedId).toBeDefined();
  });
  
  test("should store parsed metadata", async () => {
    const result = await storage.saveParsedData("http://example.com", { title: "Test", links: [] });
    expect(result.insertedId).toBeDefined();
  });
});
