// POST /api/upload
// body: { token, trackName, notes, filename, fileBase64 }
// 流程：解析 Excel → 调 AI 产出 track JSON → 直接合并上线（跳过审批）
import * as XLSX from "xlsx";
import {
  ENV, ghGetFile, ghPutFile, callAI, extractJson, setCors, readJsonBody, checkToken,
  parseCreative, dumpCreative, mergeTrack,
} from "./_lib.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./_prompt.js";

// 把 Excel 所有 sheet 转成紧凑的文本（喂给 AI）
function excelToText(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) parts.push(`### Sheet: ${sheetName}\n${csv}`);
  }
  let text = parts.join("\n\n");
  // 控制长度，避免超 token（保留前 ~12000 字符，通常足够算均值+挑Top）
  if (text.length > 12000) text = text.slice(0, 12000) + "\n...(数据过长已截断)";
  return text;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const body = await readJsonBody(req);
    const { token, trackName, notes, filename, fileBase64 } = body;

    if (!checkToken(token, ENV.UPLOAD_TOKEN))
      return res.status(401).json({ error: "上传口令错误" });
    if (!trackName || !trackName.trim())
      return res.status(400).json({ error: "请填写赛道名" });
    if (!fileBase64)
      return res.status(400).json({ error: "缺少 Excel 文件" });

    // 1) 解析 Excel
    const buf = Buffer.from(fileBase64, "base64");
    const tableText = excelToText(buf);
    if (!tableText.trim())
      return res.status(400).json({ error: "Excel 内容为空或无法解析" });

    // 2) 调 AI 产出 track JSON
    const aiRaw = await callAI(SYSTEM_PROMPT, buildUserPrompt(trackName.trim(), tableText, notes));
    const track = extractJson(aiRaw);
    track.name = trackName.trim(); // 强制对齐赛道名

    // 3) 直接合并到 creative.js 上线（跳过审批）
    const cur = await ghGetFile(ENV.CREATIVE_PATH);
    if (!cur) return res.status(500).json({ error: "线上 creative.js 读取失败" });
    const data = parseCreative(cur.text);
    const { action, name } = mergeTrack(data, track);
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString().slice(0, 10);
    const newText = dumpCreative(data);
    await ghPutFile(
      ENV.CREATIVE_PATH, newText,
      `data: 直传上线·${action === "update" ? "更新" : "新增"}赛道「${name}」创意分析`,
      cur.sha
    );

    return res.status(200).json({ ok: true, id: null, track, message: `✅ 已${action === "update" ? "更新" : "新增"}赛道「${name}」创意分析并直接上线，看板几十秒后刷新` });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
