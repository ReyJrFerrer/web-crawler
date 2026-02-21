import { BloomFilter } from "bloomfilter";
import { SimHash } from "simhash-js";
import { config } from "../config";

export class DuplicateEliminator {
	private filter: BloomFilter;
	private simhashEngine: SimHash;
	// Store recently processed simhashes to drop near-duplicates
	private recentHashes: number[] = [];
	private maxRecentHashes = 10000;

	constructor(size = 32 * 256 * 256, k = 16) {
		// defaults to 2MB filter size, roughly 10M URLs at 1% error
		this.filter = new BloomFilter(size, k);
		this.simhashEngine = new SimHash();
	}

	isNew(url: string): boolean {
		if (this.filter.test(url)) {
			// Possible duplicate
			return false;
		}
		// Definitely new
		this.filter.add(url);
		return true;
	}

	/**
	 * Computes Simhash for extracted text and compares against recently stored content.
	 * Returns true if the content is a near-duplicate, false otherwise.
	 */
	isDuplicateContent(text: string): boolean {
		if (!text || text.trim().length === 0) return false;

		const currentHash = this.simhashEngine.hash(text);

		// Compare against recently stored content
		for (const storedHash of this.recentHashes) {
			const distance = this.hammingDistance(currentHash, storedHash);
			if (distance <= config.simhashThreshold) {
				return true; // Near-duplicate found
			}
		}

		// Not a duplicate, add to recent hashes
		this.recentHashes.push(currentHash);
		if (this.recentHashes.length > this.maxRecentHashes) {
			this.recentHashes.shift();
		}

		return false;
	}

	private hammingDistance(hash1: number, hash2: number): number {
		let xor = (hash1 ^ hash2) >>> 0;
		let distance = 0;
		while (xor > 0) {
			distance += xor & 1;
			xor >>>= 1;
		}
		return distance;
	}
}
