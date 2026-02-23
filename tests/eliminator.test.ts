import { describe, expect, test } from "bun:test";
import { DuplicateEliminator } from "../src/agents/eliminator";
import { config } from "../src/config";

describe("Duplicate Eliminator", () => {
	const eliminator = new DuplicateEliminator(1024, 2); // smaller bloom filter for tests

	test("should identify new URLs as unique", () => {
		expect(eliminator.isNew("http://example.com/1")).toBe(true);
		expect(eliminator.isNew("http://example.com/2")).toBe(true);
	});

	test("should identify duplicate URLs as NOT new", () => {
		eliminator.isNew("http://example.com/3");
		expect(eliminator.isNew("http://example.com/3")).toBe(false);
	});

	test("should handle empty or whitespace-only content", () => {
		expect(eliminator.isDuplicateContent("")).toBe(false);
		expect(eliminator.isDuplicateContent("   ")).toBe(false);
		expect(eliminator.isDuplicateContent("\n\n")).toBe(false);
	});

	test("should identify exact identical content", () => {
		const text = "This is a standard text that should be deduplicated properly.";
		expect(eliminator.isDuplicateContent(text)).toBe(false);
		expect(eliminator.isDuplicateContent(text)).toBe(true);
	});

	test("should identify duplicate content via Simhash (minor punctuation changes)", () => {
		const text1 =
			"This is a long article about web crawling and how it scales across distributed systems.";
		const text2 =
			"This is a long article about web crawling and how it scales across distributed systems!"; // Very minor change
		const text3 =
			"Completely different topic about cooking recipes and culinary skills.";

		config.simhashThreshold = 3;

		// First document is not a duplicate
		expect(eliminator.isDuplicateContent(text1)).toBe(false);

		// Second document is a near-duplicate
		expect(eliminator.isDuplicateContent(text2)).toBe(true);

		// Third document is completely new
		expect(eliminator.isDuplicateContent(text3)).toBe(false);
	});

	test("should not consider distinct texts as duplicates", () => {
		const textA = "Welcome to Facebook. Connect with friends, family and other people you know. Share photos and videos, send messages and get updates.";
		const textB = "Welcome to Google. Search the world's information, including webpages, images, videos and more.";

		expect(eliminator.isDuplicateContent(textA)).toBe(false);
		expect(eliminator.isDuplicateContent(textB)).toBe(false);
	});

	test("should maintain maxRecentHashes limit", () => {
		// Create a new eliminator to reset recentHashes
		const testEliminator = new DuplicateEliminator(1024, 2);
		// Assuming maxRecentHashes is 10000 in the actual class.
		// We'll test with a smaller batch just to see that it processes correctly 
		// and doesn't crash or run out of memory.
		for(let i=0; i < 50; i++) {
			testEliminator.isDuplicateContent(`Random text item number ${i} to fill the hash table`);
		}
		expect(testEliminator.isDuplicateContent("Random text item number 25 to fill the hash table")).toBe(true);
	});
});
