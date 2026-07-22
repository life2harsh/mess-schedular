/* POST /api/vote — record one 👍/👎 per client per meal.
   Storage: Upstash Redis (REST). Configure UPSTASH_REDIS_REST_URL and
   UPSTASH_REDIS_REST_TOKEN in the Vercel project; without them the endpoint
   returns 503 and the front end simply hides the rating row. */

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return res.json();
}

const KEY_RE = /^\d{4}-\d{1,2}-\d{1,2}:(breakfast|lunch|dinner):(62|128)$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { key, vote, client } = req.body || {};
  if (!KEY_RE.test(key || "") || !["up", "down"].includes(vote) ||
      typeof client !== "string" || client.length > 64) {
    return res.status(400).json({ error: "bad request" });
  }

  try {
    const guard = `voted:${key}:${client}`;
    const result = await redis([["SET", guard, vote, "NX", "EX", "172800"]]);
    if (!result) return res.status(503).json({ error: "voting not configured" });

    if (result[0].result === "OK") {
      await redis([["HINCRBY", `votes:${key}`, vote, "1"], ["EXPIRE", `votes:${key}`, "172800"]]);
    }

    const counts = await redis([["HGETALL", `votes:${key}`]]);
    const flat = counts[0].result || [];
    const out = { up: 0, down: 0 };
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]);
    return res.status(200).json(out);
  } catch (err) {
    return res.status(502).json({ error: "storage unavailable" });
  }
}
