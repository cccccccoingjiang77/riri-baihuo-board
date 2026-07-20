// ============================================================
// 共享工具库：GitHub 读写 / creative.js 解析合并 / AI 调用 / 鉴权
// 所有敏感配置走环境变量，不写死在代码里。
// ============================================================

// ---- 环境变量（在 Vercel 项目 Settings → Environment Variables 配置）----
export const ENV = {
  // GitHub（用于读写 creative.js、待审核区）
  GH_TOKEN: process.env.GH_TOKEN,                 // GitHub Personal Access Token
  GH_OWNER: process.env.GH_OWNER || "cccccccoingjiang77",
  GH_REPO: process.env.GH_REPO || "riri-baihuo-board",
  GH_BRANCH: process.env.GH_BRANCH || "main",
  CREATIVE_PATH: process.env.CREATIVE_PATH || "site/data/creative.js",
  PENDING_DIR: process.env.PENDING_DIR || "pending",     // 待审核区目录

  // AI（OpenAI 兼容格式：OpenAI / DeepSeek / 通义 / 混元兼容端点 均可）
  AI_BASE_URL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",

  // 简单口令：上传口令 / 审核口令（同事和管理员各一个）
  UPLOAD_TOKEN: process.env.UPLOAD_TOKEN || "",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
};

const GH_API = "https://api.github.com";

function ghHeaders() {
  return {
    Authorization: `token ${ENV.GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "riri-baihuo-uploader",
  };
}

// ---------- GitHub：读取文件（返回 {text, sha} 或 null）----------
export async function ghGetFile(path) {
  const url = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${ENV.GH_BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub 读取失败 ${path}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const text = Buffer.from(j.content, "base64").toString("utf-8");
  return { text, sha: j.sha };
}

// ---------- GitHub：写入/更新文件 ----------
export async function ghPutFile(path, content, message, sha) {
  const url = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const body = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: ENV.GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub 写入失败 ${path}: ${r.status} ${await r.text()}`);
  return await r.json();
}

// ---------- GitHub：删除文件 ----------
export async function ghDeleteFile(path, message, sha) {
  const url = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: ghHeaders(),
    body: JSON.stringify({ message, sha, branch: ENV.GH_BRANCH }),
  });
  if (!r.ok) throw new Error(`GitHub 删除失败 ${path}: ${r.status} ${await r.text()}`);
  return await r.json();
}

// ---------- GitHub：列目录 ----------
export async function ghListDir(path) {
  const url = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${ENV.GH_BRANCH}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub 列目录失败 ${path}: ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

// ============================================================
// creative.js 解析 / 合并（Node 版，逻辑对齐 merge_into_creative.py）
// ============================================================

// skill 负责的字段（只覆盖这些；topMaterials 等网页侧字段保留）
export const OWNED_FIELDS = ["metrics", "sellingWords", "painWords", "sellingContext", "scripts", "keyPoints"];

// 从 creative.js 文本解析出 CREATIVE_DATA 对象
export function parseCreative(text) {
  const m = text.match(/window\.CREATIVE_DATA\s*=\s*(\{[\s\S]*\});/);
  if (!m) throw new Error("creative.js 里找不到 window.CREATIVE_DATA = {...};");
  let body = m[1];
  body = body.replace(/\/\*[\s\S]*?\*\//g, "");       // 去块注释
  body = body.replace(/(^|[^:])\/\/.*$/gm, "$1");     // 去行注释（避免误伤 http://）
  // 用 Function 安全求值（对象字面量，非 JSON——可含单引号/无引号键）
  // eslint-disable-next-line no-new-func
  const obj = Function(`"use strict";return (${body});`)();
  return obj;
}

// 写回 creative.js 文本（与 Python dump_js 风格一致）
export function dumpCreative(data) {
  return [
    "/* 卖点 & 创意分析数据层（Creative Board） */",
    "/* 由在线上传+审核后端自动写入；topMaterials 等网页侧字段自动保留 */",
    "window.CREATIVE_DATA = " + JSON.stringify(data, null, 2) + ";",
    "",
  ].join("\n");
}

// 把一个 track 合并进 data.tracks（按 name 覆盖 OWNED_FIELDS，保留其余）
export function mergeTrack(data, track) {
  const name = (track.name || "").trim();
  if (!name) throw new Error("track 缺少 name（赛道名）");
  const payload = {};
  for (const k of OWNED_FIELDS) {
    const v = track[k];
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) payload[k] = v;
  }
  data.tracks = data.tracks || [];
  for (const t of data.tracks) {
    if (t.name === name) {
      Object.assign(t, payload);
      if (track.owner) t.owner = track.owner;
      return { action: "update", name };
    }
  }
  const nt = { name };
  if (track.key) nt.key = track.key;
  if (track.owner) nt.owner = track.owner;
  Object.assign(nt, payload);
  data.tracks.push(nt);
  return { action: "add", name };
}

// ============================================================
// AI 调用（OpenAI 兼容 Chat Completions）
// ============================================================
export async function callAI(systemPrompt, userPrompt) {
  if (!ENV.AI_API_KEY) throw new Error("未配置 AI_API_KEY");
  const r = await fetch(`${ENV.AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ENV.AI_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI 调用失败: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content || "";
  return content;
}

// 从 AI 返回里稳妥提取 JSON 对象
export function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error("AI 未返回可解析的 JSON");
}

// ---------- 通用：读 body / CORS / 鉴权 ----------
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Token");
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

export function checkToken(provided, expected) {
  if (!expected) return true; // 未设口令则不校验（方便先跑通）
  return provided === expected;
}
