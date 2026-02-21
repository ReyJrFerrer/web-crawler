import { describe, expect, test } from "bun:test";
import { DuplicateEliminator } from "../src/agents/eliminator";
import { config } from "../src/config";

describe("Duplicate Eliminator", () => {
	const eliminator = new DuplicateEliminator();

	test("should identify new URLs as unique", () => {
		expect(eliminator.isNew("http://example.com/1")).toBe(true);
		expect(eliminator.isNew("http://example.com/2")).toBe(true);
	});

	test("should identify duplicate URLs as NOT new", () => {
		eliminator.isNew("http://example.com/3");
		expect(eliminator.isNew("http://example.com/3")).toBe(false);
	});

	test("should identify duplicate content via Simhash", () => {
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
});
