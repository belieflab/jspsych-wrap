import fs from "fs";
import path from "path";

export function gitCommitHash(repoDir: string = process.cwd()): string | false {
    for (const branch of ["main", "master"]) {
        try {
            const hash = fs
                .readFileSync(path.join(repoDir, ".git", "refs", "heads", branch), "utf8")
                .trim();
            return `version: ${hash.slice(-7)}`;
        } catch {
            // try next branch
        }
    }
    return false;
}
