import { useState } from "react";
import { useDataExplorer } from "../../providers/useDataExplorer";
import type { DataRecord } from "../../types";

function StatusBadge({ code }: { code: number }) {
	const color =
		code >= 500
			? "bg-red-500/15 text-red-400 border-red-500/30"
			: code >= 400
				? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
				: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${color}`}
		>
			{code}
		</span>
	);
}

function DetailPanel({ record }: { record: DataRecord }) {
	return (
		<div className="mt-0 bg-gray-950 border-t border-gray-700 px-5 py-4">
			<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
				JSON Payload
			</p>
			<pre className="text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all bg-gray-900 rounded-lg p-3">
				{JSON.stringify(record, null, 2)}
			</pre>
		</div>
	);
}

export function DataExplorer() {
	const { data } = useDataExplorer();
	const [expanded, setExpanded] = useState<string | null>(null);
	const [sortKey, setSortKey] = useState<keyof DataRecord>("timestamp");
	const [sortAsc, setSortAsc] = useState(false);

	function toggleSort(key: keyof DataRecord) {
		if (sortKey === key) {
			setSortAsc((v) => !v);
		} else {
			setSortKey(key);
			setSortAsc(false);
		}
	}

	const sorted = [...data].sort((a, b) => {
		const av = a[sortKey];
		const bv = b[sortKey];
		const cmp =
			typeof av === "number" && typeof bv === "number"
				? av - bv
				: String(av).localeCompare(String(bv));
		return sortAsc ? cmp : -cmp;
	});

	const headers: { key: keyof DataRecord; label: string }[] = [
		{ key: "url", label: "URL" },
		{ key: "status", label: "Status" },
		{ key: "title", label: "Title" },
		{ key: "linksFound", label: "Links" },
		{ key: "timestamp", label: "Timestamp" },
	];

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">Data Explorer</h2>
				<p className="text-sm text-gray-500">
					Latest fetched pages from MongoDB — click a row to inspect payload
				</p>
			</div>

			<div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-gray-800">
							{headers.map(({ key, label }) => (
								<th
									key={key}
									onClick={() => toggleSort(key)}
									className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 cursor-pointer hover:text-gray-300 select-none"
								>
									{label}
									{sortKey === key && (
										<span className="ml-1">{sortAsc ? "▲" : "▼"}</span>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sorted.map((record) => (
							<>
								<tr
									key={record.id}
									onClick={() =>
										setExpanded(expanded === record.id ? null : record.id)
									}
									className={`border-b border-gray-800/60 cursor-pointer transition-colors ${
										expanded === record.id
											? "bg-gray-800"
											: "hover:bg-gray-800/50"
									}`}
								>
									<td className="px-4 py-3 font-mono text-xs text-brand-400 max-w-xs truncate">
										{record.url}
									</td>
									<td className="px-4 py-3">
										<StatusBadge code={record.status} />
									</td>
									<td className="px-4 py-3 text-gray-300 max-w-xs truncate">
										{record.title}
									</td>
									<td className="px-4 py-3 text-gray-400 tabular-nums">
										{record.linksFound}
									</td>
									<td className="px-4 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">
										{new Date(record.timestamp).toLocaleString()}
									</td>
								</tr>
								{expanded === record.id && (
									<tr key={`${record.id}-detail`} className="bg-gray-950">
										<td colSpan={5} className="p-0">
											<DetailPanel record={record} />
										</td>
									</tr>
								)}
							</>
						))}
					</tbody>
				</table>
				{data.length === 0 && (
					<div className="py-12 text-center text-gray-600 text-sm">
						No records yet
					</div>
				)}
			</div>
		</div>
	);
}
