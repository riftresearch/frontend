import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const db = (req.query.db as string) || process.env.NEXT_PUBLIC_OTC_DB_URL;
  if (!db) return res.status(400).json({ error: "Missing db" });
  const client = new Client({ connectionString: db });
  try {
    await client.connect();
    const r = await client.query(
      "SELECT * FROM swaps ORDER BY created_at DESC LIMIT 1"
    );
    await client.end();
    return res.status(200).json((r.rows || [])[0] || null);
  } catch (e: any) {
    try {
      await client.end();
    } catch {}
    return res.status(500).json({ error: e?.message || "db error" });
  }
}
