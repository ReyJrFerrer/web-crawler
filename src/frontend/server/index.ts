import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import controlRouter from "./routes/control";
import dataRouter from "./routes/data";
import metricsRouter from "./routes/metrics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/metrics", metricsRouter);
app.use("/api/data", dataRouter);
app.use("/api/queue", controlRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req: express.Request, res: express.Response) => {
	res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── Dashboard UI ──────────────────────────────────────────────────────────────
const dashboardDist = path.join(__dirname, "../../dashboard/dist");
app.use(express.static(dashboardDist));

app.use(
	(req: express.Request, res: express.Response, next: express.NextFunction) => {
		if (req.path.startsWith("/api/")) {
			return next();
		}
		res.sendFile(path.join(dashboardDist, "index.html"));
	},
);

// ── Start ─────────────────────────────────────────────────────────────────────
export function startDashboard() {
	app.listen(PORT, "127.0.0.1", () => {
		console.log(
			`[BFF] Crawler dashboard API running on http://127.0.0.1:${PORT}`,
		);
	});
}

export default app;
