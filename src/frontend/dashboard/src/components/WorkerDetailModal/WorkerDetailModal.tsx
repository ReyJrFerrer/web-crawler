import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MetricPoint, WorkerInfo } from "../../types";

interface WorkerDetailModalProps {
	worker: WorkerInfo;
	metrics: MetricPoint[];
	onClose: () => void;
}

export function WorkerDetailModal({
	worker,
	metrics,
	onClose,
}: WorkerDetailModalProps) {
	const statusColors = {
		online: "bg-emerald-500",
		offline: "bg-gray-500",
		busy: "bg-yellow-500",
		idle: "bg-brand-500",
	};

	const totalQueue =
		worker.queueBreakdown.waiting +
		worker.queueBreakdown.active +
		worker.queueBreakdown.completed +
		worker.queueBreakdown.failed +
		worker.queueBreakdown.delayed;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
			<div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
				<div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={`w-4 h-4 rounded-full ${statusColors[worker.status]}`}
						/>
						<h2 className="text-xl font-semibold text-white">{worker.name}</h2>
						<span className="text-sm text-gray-400 capitalize">
							— {worker.status}
						</span>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
					>
						×
					</button>
				</div>

				<div className="p-6 space-y-6">
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						<div className="bg-gray-800 rounded-xl p-4">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
								URLs Discovered
							</p>
							<p className="text-3xl font-bold text-white">
								{worker.urlsDiscovered.toLocaleString()}
							</p>
						</div>
						<div className="bg-gray-800 rounded-xl p-4">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
								Pages Fetched
							</p>
							<p className="text-3xl font-bold text-brand-400">
								{worker.pagesFetched.toLocaleString()}
							</p>
						</div>
						<div className="bg-gray-800 rounded-xl p-4">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
								Total in Queue
							</p>
							<p className="text-3xl font-bold text-purple-400">
								{totalQueue.toLocaleString()}
							</p>
						</div>
						<div className="bg-gray-800 rounded-xl p-4">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
								Last Active
							</p>
							<p className="text-lg font-bold text-gray-300">
								{worker.lastActive
									? new Date(worker.lastActive).toLocaleTimeString()
									: "N/A"}
							</p>
						</div>
					</div>

					<div className="bg-gray-800 rounded-xl p-5">
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
							Queue Breakdown
						</p>
						<div className="grid grid-cols-5 gap-4">
							{(
								[
									[
										"Waiting",
										worker.queueBreakdown.waiting,
										"text-yellow-400",
										"bg-yellow-900/30",
									],
									[
										"Active",
										worker.queueBreakdown.active,
										"text-brand-400",
										"bg-brand-900/30",
									],
									[
										"Completed",
										worker.queueBreakdown.completed,
										"text-emerald-400",
										"bg-emerald-900/30",
									],
									[
										"Failed",
										worker.queueBreakdown.failed,
										"text-red-400",
										"bg-red-900/30",
									],
									[
										"Delayed",
										worker.queueBreakdown.delayed,
										"text-purple-400",
										"bg-purple-900/30",
									],
								] as const
							).map(([label, count, color, bgClass]) => (
								<div
									key={label}
									className={`${bgClass} rounded-lg p-3 text-center`}
								>
									<p className={`text-2xl font-bold ${color}`}>
										{count.toLocaleString()}
									</p>
									<p className="text-xs text-gray-500 mt-1">{label}</p>
								</div>
							))}
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div className="bg-gray-800 rounded-xl p-5">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
								RAM Usage (MB) — Last {metrics.length} samples
							</p>
							{metrics.length > 0 ? (
								<ResponsiveContainer width="100%" height={180}>
									<LineChart
										data={metrics}
										margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="time"
											tick={{ fill: "#6b7280", fontSize: 10 }}
											axisLine={{ stroke: "#4b5563" }}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: "#6b7280", fontSize: 10 }}
											axisLine={false}
											tickLine={false}
											width={35}
										/>
										<Tooltip
											contentStyle={{
												background: "#1f2937",
												border: "1px solid #374151",
												borderRadius: "8px",
												fontSize: "12px",
											}}
											labelStyle={{ color: "#9ca3af" }}
										/>
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
							) : (
								<p className="text-sm text-gray-500 text-center py-8">
									No metrics available
								</p>
							)}
						</div>

						<div className="bg-gray-800 rounded-xl p-5">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
								CPU Load (%) — Last {metrics.length} samples
							</p>
							{metrics.length > 0 ? (
								<ResponsiveContainer width="100%" height={180}>
									<LineChart
										data={metrics}
										margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="time"
											tick={{ fill: "#6b7280", fontSize: 10 }}
											axisLine={{ stroke: "#4b5563" }}
											tickLine={false}
										/>
										<YAxis
											domain={[0, 100]}
											tick={{ fill: "#6b7280", fontSize: 10 }}
											axisLine={false}
											tickLine={false}
											width={35}
										/>
										<Tooltip
											contentStyle={{
												background: "#1f2937",
												border: "1px solid #374151",
												borderRadius: "8px",
												fontSize: "12px",
											}}
											labelStyle={{ color: "#9ca3af" }}
										/>
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
							) : (
								<p className="text-sm text-gray-500 text-center py-8">
									No metrics available
								</p>
							)}
						</div>
					</div>

					<div className="bg-gray-800 rounded-xl p-5">
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
							Assigned Domains
						</p>
						<div className="flex flex-wrap gap-2">
							{worker.assignedDomains.length > 0 ? (
								worker.assignedDomains.map((domain) => (
									<span
										key={domain}
										className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300 font-mono"
									>
										{domain}
									</span>
								))
							) : (
								<p className="text-sm text-gray-500">No domains assigned</p>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
