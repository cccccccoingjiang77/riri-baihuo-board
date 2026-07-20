// GET /api/pending?token=ADMIN_TOKEN
// 列出待审核区所有记录（含 AI 产出的 track，供审核页预览）
import { ENV, ghListDir, ghGetFile, setCors, checkToken } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const token = req.query?.token || req.headers["x-token"];
    if (!checkToken(token, ENV.ADMIN_TOKEN))
      return res.status(401).json({ error: "审核口令错误" });

    const items = await ghListDir(ENV.PENDING_DIR);
    const jsons = items.filter((f) => f.type === "file" && f.name.endsWith(".json"));
    const records = [];
    for (const f of jsons) {
      const got = await ghGetFile(`${ENV.PENDING_DIR}/${f.name}`);
      if (got) {
        try {
          const rec = JSON.parse(got.text);
          rec._sha = got.sha;
          records.push(rec);
        } catch {}
      }
    }
    records.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    return res.status(200).json({ ok: true, count: records.length, records });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
