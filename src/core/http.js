import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { fetchHtmlWithBrowser } from "./browser.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

function resolvePythonPath() {
  const candidates = [
    path.join(rootDir, "tools", "python311", "python.exe"),
    path.resolve(rootDir, "..", "tools", "python311", "python.exe"),
    "python",
  ];

  return candidates[0] && candidates;
}

const pythonCandidates = resolvePythonPath();
const helperPath = path.join(rootDir, "tools", "http_fetch.py");
const providerLocks = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function execPython(args) {
  let lastError;

  for (const pythonPath of pythonCandidates) {
    try {
      return await execFileAsync(pythonPath, args, {
        cwd: rootDir,
        encoding: "utf8",
        maxBuffer: 80 * 1024 * 1024,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Python executable could not be resolved.");
}

async function runPythonFetch(url, options = {}) {
  const args = [
    helperPath,
    "--url",
    url,
    "--timeout",
    String(options.timeoutSeconds ?? 30),
    "--impersonate",
    options.impersonate ?? "chrome",
  ];

  const { stdout, stderr } = await execPython(args);

  if (stderr?.trim()) {
    console.error(stderr);
  }

  const payload = JSON.parse(stdout || "{}");
  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    ok: Boolean(payload.ok),
    status: payload.status ?? 0,
    url: payload.url || url,
    html: payload.html || "",
    via: "curl_cffi",
  };
}

async function withRateLimit(providerName, minimumDelayMs, task) {
  const previous = providerLocks.get(providerName) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      if (minimumDelayMs > 0) {
        await sleep(minimumDelayMs);
      }
      return task();
    });

  providerLocks.set(providerName, next);
  return next;
}

export async function fetchDocument(url, options = {}) {
  const attempts = options.attempts ?? 2;
  const providerName = options.providerName ?? "default";
  const minimumDelayMs = options.minimumDelayMs ?? 400;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await withRateLimit(providerName, minimumDelayMs, () =>
        runPythonFetch(url, options),
      );

      if (result.ok && result.html) {
        return result;
      }

      lastError = new Error(`Request failed with status ${result.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(attempt * 500);
    }
  }

  if (options.allowBrowserFallback) {
    return fetchHtmlWithBrowser(url, options.browserOptions);
  }

  throw lastError ?? new Error("Unknown fetch failure.");
}
