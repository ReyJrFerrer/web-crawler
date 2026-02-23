import type { WorkerInfo } from "../../types";

interface WorkerCardProps {
	worker: WorkerInfo;
	onClick: () => void;
}

export function WorkerCard({ worker, onClick }: WorkerCardProps) {
	const statusColors = {
		online: "bg-emerald-500",
		offline: "bg-gray-500",
		busy: "bg-yellow-500",
		idle: "bg-brand-500",
	};

	const statusTextColors = {
		online: "text-emerald-400",
		offline: "text-gray-400",
		busy: "text-yellow-400",
		idle: "text-brand-400",
	};

	const totalQueue =
		worker.queueBreakdown.waiting +
		worker.queueBreakdown.active +
		worker.queueBreakdown.completed +
		worker.queueBreakdown.failed +
		worker.queueBreakdown.delayed;

	return (
		<div className="group relative">
			<button
				type="button"
				onClick={onClick}
				className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-200 block"
			>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div
							className={`w-3 h-3 rounded-full ${statusColors[worker.status]}`}
						/>
						<h3 className="text-base font-semibold text-white">
							{worker.name}
						</h3>
					</div>
					<span
						className={`text-xs font-medium ${statusTextColors[worker.status]} capitalize`}
					>
						{worker.status}
					</span>
				</div>

				<div className="grid grid-cols-3 gap-3 mb-4">
					<div className="text-center">
						<p className="text-lg font-bold text-white">
							{worker.urlsDiscovered.toLocaleString()}
						</p>
						<p className="text-xs text-gray-500">URLs Discovered</p>
					</div>
					<div className="text-center">
						<p className="text-lg font-bold text-brand-400">
							{worker.pagesFetched.toLocaleString()}
						</p>
						<p className="text-xs text-gray-500">Pages Fetched</p>
					</div>
					<div className="text-center">
						<p className="text-lg font-bold text-purple-400">
							{totalQueue.toLocaleString()}
						</p>
						<p className="text-xs text-gray-500">In Queue</p>
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
						Queue Breakdown
					</p>
					<div className="grid grid-cols-5 gap-2">
						{(
							[
								["W", worker.queueBreakdown.waiting, "text-yellow-400"],
								["A", worker.queueBreakdown.active, "text-brand-500"],
								["C", worker.queueBreakdown.completed, "text-emerald-400"],
								["F", worker.queueBreakdown.failed, "text-red-400"],
								["D", worker.queueBreakdown.delayed, "text-purple-400"],
							] as const
						).map(([label, count, color]) => (
							<div key={label} className="text-center">
								<p className={`text-sm font-bold ${color}`}>{count}</p>
								<p className="text-[10px] text-gray-600">{label}</p>
							</div>
						))}
					</div>
				</div>

				{worker.assignedDomains.length > 0 && (
					<div className="mt-3 pt-3 border-t border-gray-800">
						<p className="text-[10px] text-gray-600 mb-1">Assigned Domains</p>
						<div className="flex flex-wrap gap-1">
							{worker.assignedDomains.slice(0, 2).map((domain) => (
								<span
									key={domain}
									className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400"
								>
									{domain}
								</span>
							))}
							{worker.assignedDomains.length > 2 && (
								<span className="text-[10px] text-gray-500">
									+{worker.assignedDomains.length - 2}
								</span>
							)}
						</div>
					</div>
				)}
			</button>
		</div>
	);
}
