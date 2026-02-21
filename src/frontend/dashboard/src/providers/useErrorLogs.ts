import { useCallback, useEffect, useState } from "react";
import type { ErrorLogEntry } from "../types";

const MOCK: ErrorLogEntry[] = [];

export function useErrorLogs(intervalMs = 3000) {
	const [data, setData] = useState<ErrorLogEntry[]>(MOCK);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/data/errors");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as ErrorLogEntry[];
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
