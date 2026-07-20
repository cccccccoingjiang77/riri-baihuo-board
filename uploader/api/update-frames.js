// POST /api/update-frames
// body: { token, trackName, rank, videoUrl, duration, frames: [{src, time}] }
import {
  ENV, ghGetFile, ghPutFile, parseCreative, dumpCreative,
  setCors, readJsonBody, checkToken,
} from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "只支持 POST" });

  try {
    const body = await readJsonBody(req);
    const { token, trackName, rank, videoUrl, duration, frames } = body;
    if (!checkToken(token, ENV.UPLOAD_TOKEN))
      return res.status(401).json({ error: "上传口令错误" });
    if (!trackName || !rank || !videoUrl || !Array.isArray(frames) || frames.length !== 5)
      return res.status(400).json({ error: "关键帧参数不完整" });
    if (frames.some(frame => !String(frame.src || "").startsWith("data:image/jpeg;base64,")))
      return res.status(400).json({ error: "关键帧必须是 JPEG 图片" });

    const current = await ghGetFile(ENV.CREATIVE_PATH);
    if (!current) return res.status(500).json({ error: "线上 creative.js 读取失败" });
    const data = parseCreative(current.text);
    const track = (data.tracks || []).find(item => item.name === trackName);
    const material = track?.topMaterials?.find(item => Number(item.rank) === Number(rank));
    if (!material) return res.status(409).json({ error: "素材已被新的上传替换" });
    if (String(material.videoUrl || "") !== String(videoUrl))
      return res.status(409).json({ error: "素材URL已更新，本次旧截图已跳过" });

    material.frames = frames;
    if (duration) material.duration = `约${Math.round(Number(duration))}s`;
    await ghPutFile(
      ENV.CREATIVE_PATH,
      dumpCreative(data),
      `frames: 更新「${trackName}」第${rank}条素材关键帧`,
      current.sha
    );
    return res.status(200).json({ ok: true, rank });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}
