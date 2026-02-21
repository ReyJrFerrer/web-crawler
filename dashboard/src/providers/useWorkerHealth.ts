import { useCallback, useEffect, useState } from "react";
import type { WorkerHealth } from "../types";

const MOCK: WorkerHealth = {
	workersOnline: 0,
	metrics: [],
	dnsCacheEntries: 0,
};

export function useWorkerHealth(intervalMs = 3000) {
	const [data, setData] = useState<WorkerHealth>(MOCK);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/metrics/system");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as WorkerHealth;
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
