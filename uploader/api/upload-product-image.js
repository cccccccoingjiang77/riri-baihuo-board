// POST /api/upload-product-image
// body: { token, images: [{ productName, imageBase64 }] }
// 将运营补充的商品图批量写入静态图库并更新商品名映射，后续同名商品自动复用
import { createHash } from "node:crypto";
import {
  ghGetFile, ghCommitFiles, setCors, readJsonBody, checkToken, ENV,
} from "./_lib.js";

const PRODUCT_ASSETS_PATH = "site/data/product-assets.js";
const PRODUCT_IMAGE_DIR = "site/assets/products";
const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGE_COUNT = 3;

function parseProductAssets(text) {
  const match = String(text || "").match(/window\.PRODUCT_ASSETS\s*=\s*(\{[\s\S]*\});/);
  if (!match) throw new Error("商品图库映射格式无法识别");
  return JSON.parse(match[1]);
}

function dumpProductAssets(data) {
  return [
    "/* 由运营商品图对照表及在线补图共同维护 */",
    "window.PRODUCT_ASSETS = " + JSON.stringify(data) + ";",
    "",
  ].join("\n");
}

function cleanProductName(value) {
  return String(value || "")
    .replace(/\.(?:jpe?g|png|webp)$/i, "")
    .replace(/[_＿]+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const body = await readJsonBody(req);
    if (!checkToken(body.token, ENV.UPLOAD_TOKEN))
      return res.status(401).json({ error: "上传口令错误" });

    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length) return res.status(400).json({ error: "缺少商品图" });
    if (images.length > MAX_IMAGE_COUNT)
      return res.status(400).json({ error: `单次最多补充 ${MAX_IMAGE_COUNT} 张商品图` });

    const assetsFile = await ghGetFile(PRODUCT_ASSETS_PATH);
    if (!assetsFile) return res.status(500).json({ error: "线上商品图库映射读取失败" });
    const assets = parseProductAssets(assetsFile.text);
    assets.images = assets.images || {};

    const files = [];
    const saved = [];
    for (const image of images) {
      const productName = cleanProductName(image.productName);
      if (!productName) throw new Error("商品图文件名必须是商品名称");
      const imageBase64 = String(image.imageBase64 || "").replace(/^data:image\/[^;]+;base64,/, "");
      const imageBytes = Buffer.from(imageBase64, "base64");
      if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES)
        throw new Error(`商品图「${productName}」压缩后仍超过 700KB`);

      const filename = createHash("sha1").update(productName).digest("hex").slice(0, 16) + ".webp";
      const relativePath = `assets/products/${filename}`;
      assets.images[productName] = relativePath;
      files.push({ path: `${PRODUCT_IMAGE_DIR}/${filename}`, content: imageBase64, encoding: "base64" });
      saved.push({ productName, image: relativePath });
    }

    files.push({ path: PRODUCT_ASSETS_PATH, content: dumpProductAssets(assets), encoding: "utf-8" });
    await ghCommitFiles(files, `assets: 在线补充 ${saved.length} 张商品图`);

    return res.status(200).json({
      ok: true,
      saved,
      message: `已将 ${saved.length} 张商品图加入图库，本次及后续同名商品都会自动复用`,
    });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}
