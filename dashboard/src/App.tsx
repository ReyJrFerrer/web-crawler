import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ControlPanel } from "./components/ControlPanel/ControlPanel";
import { DataExplorer } from "./components/DataExplorer/DataExplorer";
import { GlobalStatus } from "./components/GlobalStatus/GlobalStatus";
import { Layout } from "./components/Layout/Layout";
import { QueueAnalytics } from "./components/QueueAnalytics/QueueAnalytics";
import { WorkerFleet } from "./components/WorkerFleet/WorkerFleet";
import { useDataExplorer } from "./providers/useDataExplorer";
import { useErrorLogs } from "./providers/useErrorLogs";
import { useQueueMetrics } from "./providers/useQueueMetrics";
import { useWorkerHealth } from "./providers/useWorkerHealth";

// Derive global offline state: any provider being offline triggers the badge
function useIsOffline() {
	const { isOffline: q } = useQueueMetrics();
	const { isOffline: w } = useWorkerHealth();
	const { isOffline: d } = useDataExplorer();
	const { isOffline: e } = useErrorLogs();
	return q || w || d || e;
}

export default function App() {
	const isOffline = useIsOffline();

	return (
		<BrowserRouter>
			<Layout isOffline={isOffline}>
				<Routes>
					<Route path="/" element={<GlobalStatus />} />
					<Route path="/queue" element={<QueueAnalytics />} />
					<Route path="/workers" element={<WorkerFleet />} />
					<Route path="/data" element={<DataExplorer />} />
					<Route path="/control" element={<ControlPanel />} />
				</Routes>
			</Layout>
		</BrowserRouter>
	);
}
