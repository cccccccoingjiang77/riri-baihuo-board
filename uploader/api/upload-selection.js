// POST /api/upload-selection
// body: { token, trackName, notes, filename, fileBase64 }
// 流程：解析 Excel 选品表 -> 自适应表头抓取数据 -> 补齐图直链 -> 写入 pending/ (type: "selection")
import * as XLSX from "xlsx";
import {
  ENV, ghPutFile, genSelectionImage, setCors, readJsonBody, checkToken,
} from "./_lib.js";

// 自适应行高解析 Sheet，找到含有"商品名称"的行作为表头，提取对应列数据
function parseSheetToItems(sheet) {
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
      image: val("商品图") || "",
      leaf: val("具体品类") || val("商品类目") || "",
      price: num(val("单价")) || num(val("建议客单")) || num(val("参考单价")) || 0,
      roi: num(val("ROI")) || 0,
      ctr: num(val("点击率")) || num(val("CTR")) || 0,
      cvr: num(val("转化率")) || num(val("CVR")) || 0,
      placement: val("推荐版位") || "视频号、公众号与小程序",
      link: val("链路推荐") || "",
      material: val("素材链接") || "",
      landing: val("落地页链接") || "",
    };

    // 缩短 leaf 层级展示，对齐 leaf() 函数
    if (item.leaf) {
      const parts = item.leaf.split(/[>\-–]/);
      item.leaf = parts[parts.length - 1].trim();
    }

    // 联网配图兜底
    if (!item.image) {
      item.image = genSelectionImage(item.name, item.leaf);
    }

    items.push(item);
  }

  return items;
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
      return res.status(400).json({ error: "请选择赛道名" });
    if (!fileBase64)
      return res.status(400).json({ error: "缺少 Excel 文件" });

    // 1) 解析 Excel Sheets
    const buf = Buffer.from(fileBase64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });

    let cidItems = [];
    let liveItems = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const items = parseSheetToItems(ws);
      if (!items.length) continue;

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
    const dedup = (arr) => {
      const best = {};
      const counts = {};
      for (const x of arr) {
        counts[x.name] = (counts[x.name] || 0) + 1;
        if (!best[x.name] || x.roi > best[x.name].roi) {
          best[x.name] = { ...x };
        }
      }
      return Object.values(best).map(x => {
        x.dupCount = counts[x.name];
        return x;
      }).sort((a, b) => b.roi - a.roi);
    };

    const payload = {
      nonClosed: dedup(cidItems).slice(0, 40), // 限制前40条，避免数据臃肿
      quanyutong: dedup(qytItems).slice(0, 40),
      adq: dedup(adqItems).slice(0, 40),
    };

    // 4) 写入待审核区（type: "selection"）
    const id = `selection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id,
      type: "selection",
      trackName: trackName.trim(),
      notes: notes || "",
      filename: filename || "selection.xlsx",
      submittedAt: new Date().toISOString(),
      status: "pending",
      items: payload,
    };

    const path = `${ENV.PENDING_DIR}/${id}.json`;
    await ghPutFile(path, JSON.stringify(record, null, 2), `pending: 新增选品待审核 ${trackName.trim()} (${id})`);

    const totCount = payload.nonClosed.length + payload.quanyutong.length + payload.adq.length;
    return res.status(200).json({
      ok: true,
      id,
      type: "selection",
      items: payload,
      message: `已提取该赛道共 ${totCount} 款推荐选品（非闭环 ${payload.nonClosed.length} 款，闭环全域通 ${payload.quanyutong.length} 款，闭环ADQ ${payload.adq.length} 款）。已提交审核，通过后上线！`,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
