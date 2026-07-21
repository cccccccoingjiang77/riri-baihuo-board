// POST /api/upload-selection
// 支持两种请求：application/octet-stream 二进制直传，或旧版 JSON Base64
// 流程：解析 Excel 选品表 -> 自适应表头抓取数据 -> 补齐图直链 -> 直接合并上线（跳过审批）
import * as XLSX from "xlsx";
import {
  ENV, ghGetFile, ghPutFile, setCors, readJsonBody, checkToken,
  SELECTION_PATH, parseSelection, dumpSelection, mergeSelection, mergeSelectionByTarget,
} from "./_lib.js";

const PRODUCT_ASSETS_PATH = "site/data/product-assets.js";

function parseProductAssets(text) {
  const match = String(text || "").match(/window\.PRODUCT_ASSETS\s*=\s*(\{[\s\S]*\});/);
  return match ? JSON.parse(match[1]) : { images: {}, tracks: {}, leafTracks: {} };
}

function normalizeAssetKey(value) {
  return String(value || "").toLowerCase().replace(/[\s·|｜（）()【】\[\]{}，,。:：;；'"_\-/]/g, "");
}

// 自适应行高解析 Sheet，找到含有"商品名称"的行作为表头，提取对应列数据
function parseSheetToItems(sheet, productAssets) {
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!jsonRows.length) return [];

  // 1) 寻找含有 "商品名称" 的表头行索引
  let headerIdx = -1;
  for (let i = 0; i < Math.min(jsonRows.length, 10); i++) {
    const row = jsonRows[i];
    if (Array.isArray(row) && row.some(cell => String(cell || "").trim() === "商品名称")) {
      headerIdx = i;
      break;
    }
  }

  // 兜底：如果前10行都没找到，默认第2行（索引1，即 pandas header=1 的标准）
  if (headerIdx === -1) headerIdx = jsonRows.length > 1 ? 1 : 0;

  const headers = (jsonRows[headerIdx] || []).map(h => String(h || "").trim());
  const items = [];

  // 2) 逐行提取
  for (let i = headerIdx + 1; i < jsonRows.length; i++) {
    const row = jsonRows[i];
    if (!Array.isArray(row) || !row.length) continue;

    const val = (colName) => {
      const colIdx = headers.findIndex(h => h.includes(colName));
      if (colIdx === -1) return null;
      const cell = row[colIdx];
      return cell !== undefined && cell !== null ? String(cell).trim() : null;
    };

    const name = val("商品名称");
    if (!name) continue; // 商品名称为空，跳过

    // 数据类型清理
    const num = (v) => {
      if (!v) return null;
      const f = parseFloat(v.replace(/%/g, ""));
      return isNaN(f) ? null : parseFloat(f.toFixed(2));
    };

    const item = {
      name,
      industry: val("开户行业") || "",
      image: val("商品图") || "",
      leaf: val("具体品类") || val("商品类目") || "",
      price: num(val("客单价")) || num(val("单价")) || num(val("建议客单")) || num(val("参考单价")) || 0,
      spend: num(val("消耗(元)")) || num(val("总消耗")) || num(val("消耗")) || 0,
      roi: num(val("ROI")) || 0,
      ctr: num(val("点击率")) || num(val("CTR")) || 0,
      cvr: num(val("转化率")) || num(val("CVR")) || 0,
      placement: val("推荐版位") || "视频号、公众号与小程序",
      link: val("链路推荐") || "",
      material: val("素材链接") || "",
      landing: val("落地页链接") || "",
      createdAt: val("创建日期") || "",
    };
    // 缩短 leaf 层级展示，对齐 leaf() 函数
    if (item.leaf) {
      const parts = item.leaf.split(/[>\-–]/);
      item.leaf = parts[parts.length - 1].trim();
    }

    // 商品图与赛道优先复用运营维护的本地映射，不再调用联网生图
    item.image = productAssets.images?.[item.name] || item.image || "";
    item.category2 = productAssets.tracks?.[item.name]
      || productAssets.leafTracks?.[normalizeAssetKey(item.leaf)]
      || "生活日用-其他";

    items.push(item);
  }

  return items;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const isBinary = String(req.headers["content-type"] || "").includes("application/octet-stream");
    let token, trackName, notes, filename, buf;
    let selectionModule, selectionTarget, selectionLabel;
    if (isBinary) {
      token = String(req.headers["x-token"] || "");
      selectionModule = decodeURIComponent(String(req.headers["x-selection-module"] || ""));
      selectionTarget = decodeURIComponent(String(req.headers["x-selection-target"] || ""));
      selectionLabel = decodeURIComponent(String(req.headers["x-selection-label"] || ""));
      trackName = selectionLabel || decodeURIComponent(String(req.headers["x-track-name"] || ""));
      filename = decodeURIComponent(String(req.headers["x-file-name"] || "selection.xlsx"));
      notes = "";
      if (Buffer.isBuffer(req.body)) {
        buf = req.body;
      } else if (typeof req.body === "string") {
        buf = Buffer.from(req.body, "binary");
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        buf = Buffer.concat(chunks);
      }
    } else {
      const body = await readJsonBody(req);
      ({ token, trackName, notes, filename, selectionModule, selectionTarget, selectionLabel } = body);
      buf = body.fileBase64 ? Buffer.from(body.fileBase64, "base64") : null;
    }
    trackName = trackName || selectionLabel;

    if (!checkToken(token, ENV.UPLOAD_TOKEN))
      return res.status(401).json({ error: "上传口令错误" });
    if (!trackName || !trackName.trim())
      return res.status(400).json({ error: "请选择选品归属" });
    if (!buf?.length)
      return res.status(400).json({ error: "缺少 Excel 文件" });

    // 1) 读取运营商品图库映射并解析 Excel Sheets
    const assetsFile = await ghGetFile(PRODUCT_ASSETS_PATH);
    const productAssets = parseProductAssets(assetsFile?.text);
    const wb = XLSX.read(buf, { type: "buffer" });

    let cidItems = [];
    let liveItems = [];
    let allItems = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const items = parseSheetToItems(ws, productAssets);
      if (!items.length) continue;
      allItems = allItems.concat(items);

      const lowerName = sheetName.toLowerCase();
      if (lowerName.includes("cid") || lowerName.includes("非闭环")) {
        cidItems = cidItems.concat(items);
      } else if (lowerName.includes("小店") || lowerName.includes("直播") || lowerName.includes("周榜") || lowerName.includes("闭环")) {
        liveItems = liveItems.concat(items);
      } else {
        // 无法识别的 sheet 名字，默认归入小店直播
        liveItems = liveItems.concat(items);
      }
    }

    if (!allItems.length) {
      return res.status(400).json({ error: "未在 Excel 里识别到符合标准的商品选品行，请确认包含必填的'商品名称'列。" });
    }

    const dedup = (arr) => {
      const best = {};
      const counts = {};
      for (const x of arr) {
        counts[x.name] = (counts[x.name] || 0) + 1;
        const current = best[x.name];
        if (!current || (x.spend || 0) > (current.spend || 0) || ((x.spend || 0) === (current.spend || 0) && x.roi > current.roi)) best[x.name] = { ...x };
      }
      return Object.values(best).map(x => ({ ...x, dupCount: counts[x.name] }))
        .sort((a, b) => (b.spend || 0) - (a.spend || 0) || (b.roi || 0) - (a.roi || 0));
    };

    // 新版选品归属由上传者明确选择，不再依赖 Sheet 名猜测或自动平分
    if (selectionModule && selectionTarget) {
      const deduped = dedup(allItems);
      const cur = await ghGetFile(SELECTION_PATH);
      if (!cur) return res.status(500).json({ error: "线上 selection.js 读取失败" });
      const data = parseSelection(cur.text);
      const result = mergeSelectionByTarget(data, selectionModule, selectionTarget, selectionLabel || trackName, deduped);
      data.meta = data.meta || {};
      data.meta.updatedAt = new Date().toISOString().slice(0, 10);
      await ghPutFile(
        SELECTION_PATH, dumpSelection(data),
        `data: 更新选品「${selectionLabel || trackName}」`,
        cur.sha
      );
      const payload = selectionModule === "cycle"
        ? { nonClosed: [], quanyutong: [], adq: [], cycle: deduped.slice(0, 25) }
        : {
            nonClosed: selectionTarget === "nonClosed" ? deduped.slice(0, 40) : [],
            quanyutong: selectionTarget === "quanyutong" ? deduped.slice(0, 40) : [],
            adq: selectionTarget === "adq" ? deduped.slice(0, 40) : [],
          };
      return res.status(200).json({
        ok: true,
        type: "selection",
        module: selectionModule,
        target: selectionTarget,
        label: selectionLabel || trackName,
        items: payload,
        message: `已更新「${selectionLabel || trackName}」共 ${result.count} 款选品，已直接上线，看板几十秒后刷新！`,
      });
    }

    // 兼容旧版请求：按 Sheet 名推断链路
    if (!cidItems.length && !liveItems.length) {
      return res.status(400).json({ error: "未在 Excel 里识别到符合标准的商品选品行或表头，请确认表名是否含'CID/非闭环'或'小店/直播'，且必填'商品名称'列。" });
    }

    // 2) 闭环推荐链路启发式分流（全域通 vs ADQ）
    const qytItems = [];
    const adqItems = [];
    for (const x of liveItems) {
      if (x.link && x.link.includes("全域")) {
        qytItems.push(x);
      } else {
        adqItems.push(x);
      }
    }
    // 兼容：若全域通全空，默认平分
    if (!qytItems.length && adqItems.length) {
      qytItems.push(...adqItems.slice(0, Math.ceil(adqItems.length / 2)));
      adqItems.splice(0, Math.ceil(adqItems.length / 2));
    }

    // 3) 商品级去重（保留 ROI 最高的那条，并标记 dupCount 在跑创意数）

    const payload = {
      nonClosed: dedup(cidItems).slice(0, 40), // 限制前40条，避免数据臃肿
      quanyutong: dedup(qytItems).slice(0, 40),
      adq: dedup(adqItems).slice(0, 40),
    };

    // 4) 直接合并到 selection.js 上线（跳过审批）
    const cur = await ghGetFile(SELECTION_PATH);
    if (!cur) return res.status(500).json({ error: "线上 selection.js 读取失败" });
    const data = parseSelection(cur.text);
    const stats = mergeSelection(data, trackName.trim(), payload);
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString().slice(0, 10);
    const newText = dumpSelection(data);
    await ghPutFile(
      SELECTION_PATH, newText,
      `data: 直传上线·更新赛道「${trackName.trim()}」选品数据`,
      cur.sha
    );

    const totCount = payload.nonClosed.length + payload.quanyutong.length + payload.adq.length;
    return res.status(200).json({
      ok: true,
      id: null,
      type: "selection",
      items: payload,
      message: `✅ 已提取该赛道共 ${totCount} 款推荐选品（非闭环 ${payload.nonClosed.length} 款，闭环全域通 ${payload.quanyutong.length} 款，闭环ADQ ${payload.adq.length} 款），已直接上线，看板几十秒后刷新！`,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}