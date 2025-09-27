import fs from "node:fs";

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${day}-${month}-${year} (${hours}:${minutes}:${seconds})`;
}

export function createRunDir(baseDir = "./results") {
  const dir = `${baseDir}/${timestamp()}`;
  fs.mkdirSync(dir, { recursive: true });
  console.log("Output directory:", dir);
  return dir;
}

export function saveJson(label, data, opts = {}) {
  const dir = opts?.dir;
  const file = dir ? `${dir}/${label}.json` : `./${label}-${timestamp()}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("Saved:", file);
  return file;
}

export function saveHtml(label, html, opts = {}) {
  const dir = opts?.dir;
  const file = dir ? `${dir}/${label}.html` : `./${label}-${timestamp()}.html`;
  fs.writeFileSync(file, String(html));
  console.log("Saved:", file);
  return file;
}



