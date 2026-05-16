import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

export function dataRouter(dataDir: string): Router {
    const router = Router();

    router.post("/data", (req: Request, res: Response) => {
        const { filename, filedata } = req.body as { filename?: string; filedata?: string };

        if (!filename || !filedata) {
            res.status(400).json({ success: false, error: "Missing filename or filedata" });
            return;
        }

        // Prevent path traversal: strip any directory components from filename
        const safeName = path.basename(filename);
        const filePath = path.join(dataDir, `${safeName}.csv`);

        try {
            fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(filePath, filedata, "utf8");
            console.log(`Data saved: ${filePath}`);
            res.json({ success: true });
        } catch (err) {
            console.error("Failed to save data:", err);
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    return router;
}
