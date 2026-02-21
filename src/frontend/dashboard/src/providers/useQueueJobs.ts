import { useCallback, useEffect, useState } from "react";
import type { QueueJobEntry } from "../types";

export function useQueueJobs(intervalMs = 3000) {
	const [data, setData] = useState<QueueJobEntry[]>([]);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/data/jobs?limit=25");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as QueueJobEntry[];
			setData(json);
			setIsOffline(false);
		} catch {
			setData([]);
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
