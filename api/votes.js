/* GET /api/votes?key=YYYY-M-D:meal:campus — current tallies for a meal. */

const KEY_RE = /^\d{4}-\d{1,2}-\d{1,2}:(breakfast|lunch|dinner):(62|128)$/;

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(503).json({ error: "voting not configured" });

  const { key } = req.query || {};
  if (!KEY_RE.test(key || "")) return res.status(400).json({ error: "bad request" });

  try {
    const r = await fetch(`${url}/hgetall/${encodeURIComponent("votes:" + key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    const { result } = await r.json();
    const out = { up: 0, down: 0 };
    const flat = result || [];
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(out);
  } catch (err) {
    return res.status(502).json({ error: "storage unavailable" });
  }
}
