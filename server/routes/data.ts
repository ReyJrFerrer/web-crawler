import { Router } from "express";
import { getRecentData } from "../providers/dataExplorer";
import { getErrorLogs } from "../providers/errorLogs";

const router = Router();

router.get("/recent", async (_req, res) => {
	const limit = Math.min(Number(_req.query["limit"]) || 20, 100);
	const data = await getRecentData(limit);
	res.json(data);
});

router.get("/errors", async (_req, res) => {
	const limit = Math.min(Number(_req.query["limit"]) || 20, 100);
	const data = await getErrorLogs(limit);
	res.json(data);
});

export default router;
