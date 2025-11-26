import fs from "node:fs";

function isDirectory(fullPath) {
  try {
    return fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

export function getLatestResultsDir(baseDir = "./results") {
  const entries = fs.readdirSync(baseDir, { withFileTypes: false });
  const dirs = entries
    .map((name) => ({ name, full: `${baseDir}/${name}` }))
    .filter(({ full }) => isDirectory(full))
    // Only consider result folders that actually contain the expected files
    .filter(({ full }) => {
      try {
        return fs.existsSync(`${full}/normalized.json`) && fs.existsSync(`${full}/table.html`);
      } catch {
        return false;
      }
    })
    // Sort by directory modification time (most recent first).
    // This avoids issues with heterogeneous directory naming schemes.
    .map((dir) => {
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(dir.full).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { ...dir, mtimeMs };
    })
    .sort((a, b) => {
      if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
      // Tie-breaker on name if timestamps are equal
      return b.name.localeCompare(a.name, undefined, { numeric: true });
    });
  if (!dirs.length) throw new Error("No results directories found");
  return dirs[0].full;
}

// export function readTableMarkdown(resultsDir) {
//   const filePath = `${resultsDir}/table.md`;
//   try {
//     return fs.readFileSync(filePath, "utf8");
//   } catch (err) {
//     throw new Error(`Failed to read ${filePath}: ${err.message}`);
//   }
// }
