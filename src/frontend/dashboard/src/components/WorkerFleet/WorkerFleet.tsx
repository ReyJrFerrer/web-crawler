import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useWorkerHealth } from "../../providers/useWorkerHealth";

export function WorkerFleet() {
	const { data } = useWorkerHealth();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">
					Worker Fleet Health
				</h2>
				<p className="text-sm text-gray-500">
					Infrastructure metrics &amp; resource utilisation
				</p>
			</div>

			{/* Top stat cards */}
			<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
				<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
						Workers Online
					</p>
					<p className="text-4xl font-bold text-emerald-400">
						{data.workersOnline}
					</p>
					<p className="text-xs text-gray-500 mt-1">
						Node.js instances polling
					</p>
				</div>
				<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
						Current RAM
					</p>
					<p className="text-4xl font-bold text-brand-500">
						{data.metrics[data.metrics.length - 1]?.ram_mb ?? 0}
						<span className="text-base font-normal text-gray-400 ml-1">MB</span>
					</p>
					<p className="text-xs text-gray-500 mt-1">RSS memory usage</p>
				</div>
				<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
						DNS Cache Entries
					</p>
					<p className="text-4xl font-bold text-purple-400">
						{data.dnsCacheEntries.toLocaleString()}
					</p>
					<p className="text-xs text-gray-500 mt-1">
						Domain resolutions cached
					</p>
				</div>
			</div>

			{/* RAM chart */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
					RAM Usage (MB) — Last {data.metrics.length} samples
				</p>
				<ResponsiveContainer width="100%" height={220}>
					<LineChart
						data={data.metrics}
						margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
					>
						<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
						<XAxis
							dataKey="time"
							tick={{ fill: "#6b7280", fontSize: 11 }}
							axisLine={{ stroke: "#374151" }}
							tickLine={false}
						/>
						<YAxis
							tick={{ fill: "#6b7280", fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							width={40}
						/>
						<Tooltip
							contentStyle={{
								background: "#111827",
								border: "1px solid #374151",
								borderRadius: "8px",
								fontSize: "12px",
							}}
							labelStyle={{ color: "#9ca3af" }}
						/>
						<Legend wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }} />
						<Line
							type="monotone"
							dataKey="ram_mb"
							name="RAM (MB)"
							stroke="#0ea5e9"
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 4, fill: "#0ea5e9" }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>

			{/* CPU chart */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
					CPU Load (%) — Last {data.metrics.length} samples
				</p>
				<ResponsiveContainer width="100%" height={220}>
					<LineChart
						data={data.metrics}
						margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
					>
						<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
						<XAxis
							dataKey="time"
							tick={{ fill: "#6b7280", fontSize: 11 }}
							axisLine={{ stroke: "#374151" }}
							tickLine={false}
						/>
						<YAxis
							domain={[0, 100]}
							tick={{ fill: "#6b7280", fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							width={40}
						/>
						<Tooltip
							contentStyle={{
								background: "#111827",
								border: "1px solid #374151",
								borderRadius: "8px",
								fontSize: "12px",
							}}
							labelStyle={{ color: "#9ca3af" }}
						/>
						<Legend wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }} />
						<Line
							type="monotone"
							dataKey="cpu_percent"
							name="CPU (%)"
							stroke="#a855f7"
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 4, fill: "#a855f7" }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
