import { useCallback, useEffect, useState } from "react";
import type { ErrorLogEntry } from "../types";

const MOCK: ErrorLogEntry[] = [
	{
		url: "https://badsite.com",
		error: "Timeout exceeded (10000ms)",
		attempts: 3,
	},
	{
		url: "https://secure.com",
		error: "403 Forbidden - WAF Block",
		attempts: 1,
	},
	{
		url: "https://hugepdf.com/file.pdf",
		error: "Aborted: Invalid Content-Type",
		attempts: 1,
	},
];

export function useErrorLogs(intervalMs = 3000) {
	const [data, setData] = useState<ErrorLogEntry[]>([]);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/data/errors");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as ErrorLogEntry[];
			// Empty array is valid (no errors) - don't treat it as offline
			setData(json);
			setIsOffline(false);
		} catch {
			// Only fall back to mock if we genuinely can't reach the BFF
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
