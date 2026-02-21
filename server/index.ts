import cors from "cors";
import express from "express";
import controlRouter from "./routes/control";
import dataRouter from "./routes/data";
import metricsRouter from "./routes/metrics";

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
app.get("/health", (_req, res) => {
	res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
	console.log(
		`[BFF] Crawler dashboard API running on http://localhost:${PORT}`,
	);
});

export default app;
