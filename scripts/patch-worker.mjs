#!/usr/bin/env node
/**
 * adapter-cloudflare regenerates the file at wrangler `main` (worker/index.ts)
 * on every build, with only a fetch handler. This post-build step re-attaches
 * the queue consumer and the cron handler. Runs as part of `npm run build`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../worker/index.ts', import.meta.url));
let source = readFileSync(target, 'utf8');

if (source.includes('processJobBatch')) {
  console.log('[patch-worker] already patched');
  process.exit(0);
}

const importAnchor = 'import { env } from "cloudflare:workers";';
const exportAnchor = /export\s*\{\s*worker_default as default\s*\};?/;

if (!source.includes(importAnchor) || !exportAnchor.test(source)) {
  console.error('[patch-worker] anchors not found — adapter output changed, update this script');
  process.exit(1);
}

source = source.replace(
  importAnchor,
  `${importAnchor}
import { processJobBatch } from "../src/lib/server/queue/consumer";
import { runScheduledMaintenance } from "../src/lib/server/maintenance";`
);

// Disable the adapter's built-in worktop cache layer: it caches HTML under
// unversioned URL keys, so after a deploy it serves stale pages that reference
// deleted immutable assets. src/hooks.server.ts owns HTML caching instead
// (version-prefixed keys + purge tags).
const cacheReadAnchor = 'let res = !pragma.includes("no-cache") && await r2(req);';
const cacheWriteAnchor = 'return pragma && res.status < 400 ? c(req, res, ctx) : res;';
if (!source.includes(cacheReadAnchor) || !source.includes(cacheWriteAnchor)) {
  console.error(
    '[patch-worker] cache anchors not found — adapter output changed, update this script'
  );
  process.exit(1);
}
source = source.replace(cacheReadAnchor, 'let res;');
source = source.replace(cacheWriteAnchor, 'return res;');

source = source.replace(
  exportAnchor,
  `// --- appended by scripts/patch-worker.mjs -----------------------------------
/** Queue consumer: background jobs (machine translation, batch work). */
worker_default.queue = async (batch, env2) => {
  await processJobBatch(env2.DB, env2, batch);
};
/** Cron: session/token expiry, submission retention, orphaned media. */
worker_default.scheduled = (controller, env2, ctx) => {
  ctx.waitUntil(runScheduledMaintenance(env2));
};
export {
  worker_default as default
};`
);

writeFileSync(target, source);
console.log('[patch-worker] queue + scheduled handlers attached');
