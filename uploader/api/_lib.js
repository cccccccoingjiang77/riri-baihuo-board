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

// ---------- GitHub：写入二进制 Base64 文件 ----------
export async function ghPutBase64File(path, base64Content, message, sha) {
  const url = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const body = {
    message,
    content: base64Content,
    branch: ENV.GH_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub 图片写入失败 ${path}: ${r.status} ${await r.text()}`);
  return await r.json();
}

// ---------- GitHub：多个文件原子提交（用于关键帧图片 + creative.js）----------
export async function ghCommitFiles(files, message) {
  const refUrl = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/ref/heads/${ENV.GH_BRANCH}`;
  const updateRefUrl = `${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/refs/heads/${ENV.GH_BRANCH}`;
  const refResponse = await fetch(refUrl, { headers: ghHeaders() });
  if (!refResponse.ok) throw new Error(`GitHub 分支读取失败: ${refResponse.status} ${await refResponse.text()}`);
  const ref = await refResponse.json();
  const baseCommitSha = ref.object.sha;

  const commitResponse = await fetch(`${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/commits/${baseCommitSha}`, { headers: ghHeaders() });
  if (!commitResponse.ok) throw new Error(`GitHub commit读取失败: ${commitResponse.status}`);
  const baseCommit = await commitResponse.json();

  const treeEntries = [];
  for (const file of files) {
    const blobResponse = await fetch(`${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/blobs`, {
      method: "POST",
      headers: ghHeaders(),
      body: JSON.stringify({ content: file.content, encoding: file.encoding || "utf-8" }),
    });
    if (!blobResponse.ok) throw new Error(`GitHub blob创建失败 ${file.path}: ${blobResponse.status} ${await blobResponse.text()}`);
    const blob = await blobResponse.json();
    treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const treeResponse = await fetch(`${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/trees`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
  });
  if (!treeResponse.ok) throw new Error(`GitHub tree创建失败: ${treeResponse.status} ${await treeResponse.text()}`);
  const tree = await treeResponse.json();

  const newCommitResponse = await fetch(`${GH_API}/repos/${ENV.GH_OWNER}/${ENV.GH_REPO}/git/commits`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
  });
  if (!newCommitResponse.ok) throw new Error(`GitHub commit创建失败: ${newCommitResponse.status} ${await newCommitResponse.text()}`);
  const newCommit = await newCommitResponse.json();

  const updateResponse = await fetch(updateRefUrl, {
    method: "PATCH",
    headers: ghHeaders(),
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateResponse.ok) {
    const error = new Error(`GitHub分支并发更新冲突: ${updateResponse.status} ${await updateResponse.text()}`);
    error.code = "GH_REF_CONFLICT";
    throw error;
  }
  return newCommit;
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

// skill 负责的字段（基础分析字段；topMaterials 单独做保护性合并）
export const OWNED_FIELDS = ["metrics", "sellingWords", "painWords", "sellingContext", "scripts", "keyPoints"];

function mergeTopMaterials(existing = [], incoming = []) {
  if (!incoming.length) return existing;
  return incoming.map((item, index) => ({
    ...item,
    rank: index + 1,
    videoUrl: item.videoUrl || "",
    frames: Array.isArray(item.frames) ? item.frames : [],
  }));
}

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
    "/* 由在线上传后端自动写入；关键帧按每次上传的素材URL异步重建 */",
    "window.CREATIVE_DATA = " + JSON.stringify(data, null, 2) + ";",
    "",
  ].join("\n");
}

// 把一个 track 合并进 data.tracks；基础模块覆盖，Top素材按本次上传整体替换
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
      if (Array.isArray(track.topMaterials) && track.topMaterials.length) {
        t.topMaterials = mergeTopMaterials(t.topMaterials, track.topMaterials);
      }
      if (track.owner) t.owner = track.owner;
      return { action: "update", name };
    }
  }
  const nt = { name };
  if (track.key) nt.key = track.key;
  if (track.owner) nt.owner = track.owner;
  Object.assign(nt, payload);
  if (Array.isArray(track.topMaterials) && track.topMaterials.length) {
    nt.topMaterials = mergeTopMaterials([], track.topMaterials);
  }
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Token, X-Selection-Module, X-Selection-Target, X-Selection-Label, X-File-Name");
}

// ============================================================
// selection.js 选品数据 解析 / 合并 / 写回 (对齐 build_selection_data.py)
// ============================================================

export const SELECTION_PATH = process.env.SELECTION_PATH || "site/data/selection.js";

// 解析 selection.js 为 js 对象
export function parseSelection(text) {
  const m = text.match(/window\.SELECTION_DATA\s*=\s*(\{[\s\S]*\});/);
  if (!m) throw new Error("selection.js 里找不到 window.SELECTION_DATA = {...};");
  let body = m[1];
  body = body.replace(/\/\*[\s\S]*?\*\//g, "");       // 去块注释
  body = body.replace(/(^|[^:])\/\/.*$/gm, "$1");     // 去行注释
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${body});`)();
}

// 写回 selection.js 文本
export function dumpSelection(data) {
  return [
    "/* 由在线上传+审核后端自动写入 */",
    "/* 商品图由系统按商品名自动联网生成(pollinations)，运营只需维护商品名 */",
    "window.SELECTION_DATA = " + JSON.stringify(data, null, 2) + ";",
    "",
  ].join("\n");
}

// 联网画图：pollinations 免费生图直链
export function genSelectionImage(name, leaf) {
  const category = String(leaf || "").trim();
  const product = category || String(name || "").replace(/[A-Za-z0-9®™·]/g, " ").trim();
  const kw = `${product} 商品本体`.trim();
  const prompt = `${kw}, 只展示${product}产品本体, 不展示品牌logo和文字, 电商产品主图, 纯白背景, 商品居中, 高清写实`;
  const seed = Math.abs(hashString(`${name} ${category}`.trim())) % 100000;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=500&height=500&nologo=true&seed=${seed}`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// 按赛道覆盖合并选品数据：
// 1. 在 nonClosed.items、quanyutong.items、adq.items 中，过滤掉所有 category2 === trackName 的旧数据
// 2. 将新的非闭环、全域通、ADQ 选品追加进去，按 ROI 从大到小排序，保留 Top
export function mergeSelection(data, trackName, newItems) {
  const filterOld = (arr) => (arr || []).filter(x => x.category2 !== trackName);
  
  data.nonClosed = data.nonClosed || { items: [] };
  data.nonClosed.items = filterOld(data.nonClosed.items);

  data.closed = data.closed || { channels: { quanyutong: { items: [] }, adq: { items: [] } } };
  data.closed.channels = data.closed.channels || { quanyutong: { items: [] }, adq: { items: [] } };
  data.closed.channels.quanyutong = data.closed.channels.quanyutong || { items: [] };
  data.closed.channels.adq = data.closed.channels.adq || { items: [] };
  
  data.closed.channels.quanyutong.items = filterOld(data.closed.channels.quanyutong.items);
  data.closed.channels.adq.items = filterOld(data.closed.channels.adq.items);

  // 追加新数据
  for (const item of (newItems.nonClosed || [])) {
    item.category2 = trackName;
    data.nonClosed.items.push(item);
  }
  for (const item of (newItems.quanyutong || [])) {
    item.category2 = trackName;
    data.closed.channels.quanyutong.items.push(item);
  }
  for (const item of (newItems.adq || [])) {
    item.category2 = trackName;
    data.closed.channels.adq.items.push(item);
  }

  // 排序
  const sortByRoi = (arr) => arr.sort((a, b) => (b.roi || 0) - (a.roi || 0));
  sortByRoi(data.nonClosed.items);
  sortByRoi(data.closed.channels.quanyutong.items);
  sortByRoi(data.closed.channels.adq.items);

  return { nonClosedCount: newItems.nonClosed?.length || 0, closedCount: (newItems.quanyutong?.length || 0) + (newItems.adq?.length || 0) };
}

export function mergeSelectionByTarget(data, module, target, label, items) {
  const incoming = [...(items || [])];
  const mergeItems = (existing, limit = 40) => {
    const byName = new Map((existing || []).map(x => [x.name, x]));
    incoming.forEach(x => byName.set(x.name, { ...(byName.get(x.name) || {}), ...x }));
    return [...byName.values()]
      .sort((a, b) => (b.spend || 0) - (a.spend || 0) || (b.roi || 0) - (a.roi || 0))
      .slice(0, limit);
  };
  const cycleTargets = new Set([
    "xiaohan_dahan", "spring_festival", "lichun_yushui", "kaixue_kaigong",
    "jingzhe_chunfen", "huinantian", "qingming", "guyu_lixia", "wuyi", "muqin_jie",
    "meiyu", "618", "xiazhi_sanfu", "xiaoshu_dashu", "liqiu_chushu", "kaixue_qiu",
    "bailu_qiufen", "zhongqiu_guoqing", "hanlu_shuangjiang", "shuang11",
    "lidong_xiaoxue", "shuang12", "daxue_dongzhi", "yuandan_niandi",
  ]);

  if (module === "cycle") {
    if (!cycleTargets.has(target)) throw new Error("未知的热点周期或节气节点");
    data.cycles = data.cycles || {};
    const list = mergeItems(data.cycles[target]?.items, 25);
    data.cycles[target] = { label, items: list };
    return { module, target, label, count: incoming.length, total: list.length };
  }

  if (module !== "link") throw new Error("未知的选品归属模块");
  data.nonClosed = data.nonClosed || { items: [] };
  data.closed = data.closed || { channels: {} };
  data.closed.channels = data.closed.channels || {};
  data.closed.channels.quanyutong = data.closed.channels.quanyutong || { items: [] };
  data.closed.channels.adq = data.closed.channels.adq || { items: [] };

  let list;
  if (target === "nonClosed") data.nonClosed.items = list = mergeItems(data.nonClosed.items);
  else if (target === "quanyutong") data.closed.channels.quanyutong.items = list = mergeItems(data.closed.channels.quanyutong.items);
  else if (target === "adq") data.closed.channels.adq.items = list = mergeItems(data.closed.channels.adq.items);
  else throw new Error("未知的分链路榜单归属");

  return { module: "link", target, label, count: incoming.length, total: list.length };
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