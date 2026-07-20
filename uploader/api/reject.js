// POST /api/reject
// body: { token, id }  token=ADMIN_TOKEN
// 驳回：直接删除待审核记录（不改 creative.js）
import { ENV, ghGetFile, ghDeleteFile, setCors, readJsonBody, checkToken } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const body = await readJsonBody(req);
    const { token, id } = body;
    if (!checkToken(token, ENV.ADMIN_TOKEN))
      return res.status(401).json({ error: "审核口令错误" });
    if (!id) return res.status(400).json({ error: "缺少记录 id" });

    const path = `${ENV.PENDING_DIR}/${id}.json`;
    const got = await ghGetFile(path);
    if (!got) return res.status(404).json({ error: "记录不存在（可能已处理）" });
    await ghDeleteFile(path, `pending: 驳回并清除 ${id}`, got.sha);
    return res.status(200).json({ ok: true, message: "已驳回并清除该待审核记录" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
