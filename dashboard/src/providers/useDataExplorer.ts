import { useCallback, useEffect, useState } from "react";
import type { DataRecord } from "../types";

const MOCK: DataRecord[] = [
	{
		id: "64a1b2c3",
		url: "https://example.com/about",
		status: 200,
		title: "About Us - Example Corp",
		linksFound: 45,
		timestamp: "2026-02-20T10:05:00Z",
	},
	{
		id: "64a1b2c4",
		url: "https://example.com/contact",
		status: 404,
		title: "Not Found",
		linksFound: 0,
		timestamp: "2026-02-20T10:05:02Z",
	},
	{
		id: "64a1b2c5",
		url: "https://wikipedia.org/wiki/Web_crawler",
		status: 200,
		title: "Web crawler - Wikipedia",
		linksFound: 132,
		timestamp: "2026-02-20T10:05:08Z",
	},
	{
		id: "64a1b2c6",
		url: "https://example.com/products",
		status: 200,
		title: "Products - Example Corp",
		linksFound: 27,
		timestamp: "2026-02-20T10:05:15Z",
	},
	{
		id: "64a1b2c7",
		url: "https://badsite.com/page",
		status: 503,
		title: "Service Unavailable",
		linksFound: 0,
		timestamp: "2026-02-20T10:05:20Z",
	},
];

export function useDataExplorer(intervalMs = 3000) {
	const [data, setData] = useState<DataRecord[]>(MOCK);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/data/recent");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as DataRecord[];
			setData(json);
			setIsOffline(false);
		} catch {
			setData(MOCK);
			setIsOffline(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchData();
		const id = setInterval(() => void fetchData(), intervalMs);
		return () => clearInterval(id);
	}, [fetchData, intervalMs]);

	return { data, isOffline, loading };
}
