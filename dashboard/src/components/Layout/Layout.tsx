import type React from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
	{ to: "/", label: "Command Center", icon: "⬡" },
	{ to: "/queue", label: "Queue Analytics", icon: "⬢" },
	{ to: "/workers", label: "Worker Fleet", icon: "⬡" },
	{ to: "/data", label: "Data Explorer", icon: "⬢" },
	{ to: "/control", label: "Control Panel", icon: "⬡" },
];

interface LayoutProps {
	children: React.ReactNode;
	isOffline: boolean;
}

export function Layout({ children, isOffline }: LayoutProps) {
	return (
		<div className="flex h-screen overflow-hidden">
			{/* Sidebar */}
			<aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
				<div className="px-5 py-5 border-b border-gray-800">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
						Web Crawler
					</p>
					<h1 className="text-lg font-bold text-white leading-tight">
						Telemetry
						<br />
						Dashboard
					</h1>
				</div>

				<nav className="flex-1 py-4 space-y-0.5 px-2">
					{NAV_ITEMS.map(({ to, label, icon }) => (
						<NavLink
							key={to}
							to={to}
							end={to === "/"}
							className={({ isActive }) =>
								[
									"flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
									isActive
										? "bg-brand-600 text-white"
										: "text-gray-400 hover:text-white hover:bg-gray-800",
								].join(" ")
							}
						>
							<span className="text-base leading-none">{icon}</span>
							{label}
						</NavLink>
					))}
				</nav>

				<div className="px-4 py-4 border-t border-gray-800 text-xs text-gray-600">
					BFF :4000 &nbsp;|&nbsp; UI :5173
				</div>
			</aside>

			{/* Main */}
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
				{/* Header */}
				<header className="h-14 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
					<p className="text-sm text-gray-400">
						Real-time crawler telemetry &mdash; polling every 3 s
					</p>
					{isOffline && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-semibold border border-yellow-500/30">
							<span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
							Offline Mode
						</span>
					)}
				</header>

				{/* Page content */}
				<main className="flex-1 overflow-y-auto p-6">{children}</main>
			</div>
		</div>
	);
}
