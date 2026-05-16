import { Router, Request, Response } from "express";
import path from "path";

const MAGIC_WORD_PAGE = `<!DOCTYPE html>
<html><body style="text-align:center;font-family:sans-serif">
  <h1>Ah! Ah! Ah!</h1>
  <h1>You didn't say the magic word!</h1>
  <img src="/wrap/magicword.gif" alt="magic word">
</body></html>`;

export function redirectRouter(staticDir: string): Router {
    const router = Router();

    // Replicates link/redirect.php: routes platform participants to index.html
    router.get("/redirect", (req: Request, res: Response) => {
        const { workerId, PROLIFIC_PID, participantId } = req.query as Record<string, string>;

        if (workerId) {
            res.redirect(302, `/?workerId=${encodeURIComponent(workerId)}`);
        } else if (PROLIFIC_PID) {
            res.redirect(302, `/?PROLIFIC_PID=${encodeURIComponent(PROLIFIC_PID)}`);
        } else if (participantId) {
            res.redirect(302, `/?participantId=${encodeURIComponent(participantId)}`);
        } else {
            res.status(403).send(MAGIC_WORD_PAGE);
        }
    });

    return router;
}
