/*
  Generate synthetic minute-level analytics data and write to src/data/minute_analytics.json

  Usage:
    node scripts/generate_analytics.js --days=60

  Notes:
  - Produces realistic diurnal cycles, weekly seasonality, and light trend/noise
  - Output schema matches what useAnalyticsSeries expects:
      {
        start: ISO8601,        // first minute timestamp
        intervalMinutes: 1,
        volumeUsd: number[],   // per-minute USD volume
        txns: number[]         // per-minute txn counts
      }
*/

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { days: 60 };
  for (const a of args) {
    const m = a.match(/^--days=(\d+)/);
    if (m) out.days = Number(m[1]);
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function generate({ days }) {
  const minutes = days * 24 * 60;
  const now = Date.now();
  const start = now - minutes * 60 * 1000;

  const volumeUsd = new Array(minutes);
  const txns = new Array(minutes);

  for (let i = 0; i < minutes; i++) {
    // Volume: random between 0 and 1000
    volumeUsd[i] = Math.round(Math.random() * 1000 * 100) / 100; // Round to 2 decimal places

    // Transactions: random between 0 and 50
    txns[i] = Math.round(Math.random() * 50);
  }

  return {
    start: new Date(start).toISOString(),
    intervalMinutes: 1,
    volumeUsd,
    txns,
  };
}

function main() {
  const { days } = parseArgs();
  const out = generate({ days });
  const outPath = path.join(__dirname, "../src/data/minute_analytics.json");
  const json = JSON.stringify(out);
  fs.writeFileSync(outPath, json);
  console.log(`Wrote ${out.volumeUsd.length} minutes to ${outPath}`);
}

if (require.main === module) {
  main();
}
