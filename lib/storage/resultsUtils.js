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
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
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
