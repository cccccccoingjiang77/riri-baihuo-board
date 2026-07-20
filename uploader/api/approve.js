// POST /api/approve
// body: { token, id, track? }   token=ADMIN_TOKEN；track 可选（管理员在审核页微调后的最终版）
// 流程：读 creative.js → 合并该 track → 写回（触发 Pages 重建）→ 删除待审记录
import {
  ENV, ghGetFile, ghPutFile, ghDeleteFile,
  parseCreative, dumpCreative, mergeTrack,
  setCors, readJsonBody, checkToken,
} from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const body = await readJsonBody(req);
    const { token, id } = body;
    if (!checkToken(token, ENV.ADMIN_TOKEN))
      return res.status(401).json({ error: "审核口令错误" });
    if (!id) return res.status(400).json({ error: "缺少待审核记录 id" });

    // 1) 取待审核记录
    const pendingPath = `${ENV.PENDING_DIR}/${id}.json`;
    const pend = await ghGetFile(pendingPath);
    if (!pend) return res.status(404).json({ error: "待审核记录不存在（可能已处理）" });
    const record = JSON.parse(pend.text);
    // 允许管理员传入微调后的 track，否则用记录里 AI 产出的
    const track = body.track || record.track;
    track.name = record.trackName; // 保底对齐

    // 2) 读 creative.js → 合并 → 写回
    const cur = await ghGetFile(ENV.CREATIVE_PATH);
    if (!cur) return res.status(500).json({ error: "线上 creative.js 读取失败" });
    const data = parseCreative(cur.text);
    const { action, name } = mergeTrack(data, track);
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString().slice(0, 10);
    const newText = dumpCreative(data);
    await ghPutFile(
      ENV.CREATIVE_PATH, newText,
      `data: 审核通过·${action === "update" ? "更新" : "新增"}赛道「${name}」(${id})`,
      cur.sha
    );

    // 3) 删除待审记录
    try { await ghDeleteFile(pendingPath, `pending: 已审核通过并清除 ${id}`, pend.sha); } catch {}

    return res.status(200).json({
      ok: true, action, name,
      message: `已${action === "update" ? "更新" : "新增"}赛道「${name}」并推送上线，看板几十秒后刷新。`,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
