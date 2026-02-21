import { useCallback, useEffect, useState } from "react";
import type { DataRecord } from "../types";

const MOCK: DataRecord[] = [];

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
