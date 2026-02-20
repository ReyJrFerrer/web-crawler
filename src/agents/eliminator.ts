import { BloomFilter } from "bloomfilter";

export class DuplicateEliminator {
	private filter: BloomFilter;

	constructor(size = 32 * 256 * 256, k = 16) {
		// defaults to 2MB filter size, roughly 10M URLs at 1% error
		this.filter = new BloomFilter(size, k);
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
}
