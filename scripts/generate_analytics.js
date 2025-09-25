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

  // Base scales
  const baseDailyUsd = 48_000_000 / 30; // average daily volume ≈ $1.6M
  const perMinuteBase = baseDailyUsd / (24 * 60);

  // Weekly seasonality factors (Sun..Sat)
  const dowFactor = [0.9, 0.95, 1.05, 1.1, 1.15, 1.1, 0.98];

  for (let i = 0; i < minutes; i++) {
    const t = start + i * 60 * 1000;
    const d = new Date(t);

    const minuteOfDay = d.getHours() * 60 + d.getMinutes();
    const dayOfWeek = d.getDay();

    // Diurnal cycle (peaks midday/evening)
    const diurnal =
      0.6 +
      0.35 * Math.sin((2 * Math.PI * (minuteOfDay - 11 * 60)) / (24 * 60)) +
      0.15 * Math.sin((4 * Math.PI * (minuteOfDay - 19 * 60)) / (24 * 60));

    // Long-term drift (slow 2% monthly trend approximation)
    const monthlyDrift = 1 + 0.02 * (i / (30 * 24 * 60));

    // Random noise
    const noise = 0.85 + Math.random() * 0.3; // 0.85..1.15

    // Compose volume
    const usd =
      perMinuteBase * diurnal * dowFactor[dayOfWeek] * monthlyDrift * noise;
    volumeUsd[i] = Math.round(clamp(usd, 50, 250_000));

    // Transactions correlate with USD volume but are integers with smaller variance
    // Assume avg order size ≈ $1,200 and cap extreme outliers
    const estTx = volumeUsd[i] / (900 + Math.random() * 900);
    txns[i] = Math.max(1, Math.round(clamp(estTx, 1, 600)));
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
