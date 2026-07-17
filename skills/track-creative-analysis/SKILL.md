---
name: track-creative-analysis
description: 赛道卖点创意分析助手（自动化管线版）。赛道同学把「本赛道的原始数据（消耗报表 CSV / 跑量素材口播 / 赛道理解）」交给 AI，AI 自动加工成标准卖点&创意分析，并【直接写入在线看板的数据源 site/data/creative.js】，本地预览确认后一键推送，在线网址即刻更新。当用户提及「赛道创意分析」「补充XX赛道卖点」「填报/更新XX赛道」「清洁工具/家纺/功效品/收纳/餐厨 赛道分析」「更新创意看板」等意图时加载此 skill。以【清洁工具】赛道为黄金样例作为标杆。
---

# 赛道卖点创意分析助手 · 自动化管线版

## 这个 skill 解决什么

葱搭了一个「卖点 & 创意分析看板」在线网页，需要 5 个居家日用赛道各自补充明细。
本 skill 发给各赛道同学，让他们**在自己本地的 CodeBuddy 里**完成从原始数据到在线更新的全过程：

> 赛道同学把**原始数据**丢进来（消耗 CSV / 跑量素材口播 / 自己的赛道理解），
> 对 AI 说一句「补充 XX 赛道」，AI 就会：
> **读原始数据 → 按标准加工成 track → 直接写入 `site/data/creative.js` → 本地预览确认 → 一键推送**，
> 在线看板随之更新。**赛道同学不碰表格、不碰 JS 格式，只需给数据 + 说清楚赛道理解。**

**【清洁工具】赛道是黄金样例（standard）**：真实明星代言、真实跑量素材、完整黄金五段式。
其它赛道照着这个"深度和颗粒度"产出。见 `references/golden-example-清洁工具.md`。

---

## 核心工作流（AI 执行，5 步）

当赛道同学说「我要补充 / 更新 XX 赛道」时，按下面走：

### Step 1 · 给标杆，对齐"什么叫合格"
读 `references/golden-example-清洁工具.md`，向同学展示清洁工具赛道完整范本，
让 ta 直观看到卖点词要多细、动因要多具体、话术要多"能直接抄去投放"、关键点四维度怎么写。
**一句话对齐标准**：不是填几个词交差，而是"看完这份别人就能照着投放"。

### Step 2 · 收原始数据（能给多少给多少，缺的 AI 来问）
向同学要以下原始素材（不必齐全）：
1. **消耗/指标报表**：分客户/分链路/分创意的表现 CSV（含日均消耗、CTR、完播、CVR、CPM）。
   —— 有报表最好，AI 会自己算赛道均值、挑出 Top 跑量客户。
2. **跑量素材**：Top 素材的原片 URL 或口播/字幕/脚本（最好带时间轴）。
3. **赛道理解**：这个赛道最买账的卖点、最痛的痛点、季节/场景怎么影响需求、有无明星/达人背书。

### Step 3 · AI 加工成标准 track（skill 的核心）
严格按 `references/schema.md` 把原始信息加工成一个赛道 JSON：
- `metrics` 赛道指标（有 CSV 就用脚本/口径算真实均值，标注口径）
- `sellingWords` 卖点词云（12-16 个，带权重 0-100）
- `painWords` 痛点词（4-6 个，可选）
- `sellingContext` 卖点动因（2-3 条，**最重要**：卖点为什么此刻成立）
- `scripts` 爆款话术（6 条左右，能直接抄去投放）
- `keyPoints` 跑量关键点（固定 4 维度）

加工要点：
- **对标黄金样例的深度**，拒绝"高质量/性价比/好用"这种空泛词。
- 若给了消耗 CSV，先做数据分析（算均值、按客户消耗排 Top、甄别品类是否混入），再落成 track。
- 信息不足就回到 Step 2 追问，宁可少而精。
- **只产 skill 负责的 6 个模块**；`topMaterials`（Top素材关键帧/黄金五段式/videoUrl）由网页侧维护，
  合并时会**原样保留**，赛道同学不用管。

### Step 4 · AI 直接写入在线看板数据源（关键）
把加工好的 track 存成 JSON（放进 `inbox/` 或任意路径），运行：
```bash
# 单个赛道
python3 scripts/merge_into_creative.py inbox/XX赛道.track.json
# 或收 inbox/ 下所有 *.json 一起合并
python3 scripts/merge_into_creative.py --inbox
```
脚本会**按赛道 name 把这些字段就地合并进 `site/data/creative.js`**：
同名赛道→只覆盖上面 6 个模块；找不到→新增赛道；`topMaterials` 等网页侧字段**深度保留、绝不误删**。

### Step 5 · 本地预览 + 一键上线
```bash
cd site && python3 -m http.server 8770    # 打开 http://localhost:8770/creative.html?track=XX 确认
```
确认无误后推送（在线网址随之更新）：
```bash
python3 scripts/merge_into_creative.py inbox/XX赛道.track.json --push
```
`--push` 会自动 `git add / commit / push`，托管平台（GitHub Pages）几十秒内刷新在线看板。

---

## 目录

```
track-creative-analysis/
├── SKILL.md                              # 本文件：自动化主流程
├── inbox/                                # ★ 原始数据/产出 track JSON 的投放区（同学把数据丢这里）
│   └── .gitkeep
├── references/
│   ├── schema.md                         # 字段规范（六大模块 + track JSON 格式）
│   └── golden-example-清洁工具.md         # 黄金样例：清洁工具赛道完整范本（标杆）
└── scripts/
    ├── merge_into_creative.py            # ★ 核心：track JSON 直写 site/data/creative.js（+可--push）
    ├── build_track_excel.py              # 备用：仍想走 Excel 回收时，生成《填报-XX赛道.xlsx》
    └── example-清洁工具.json              # 黄金样例对应的 track JSON（可直接跑通验证）
```

## 关键约束（务必遵守）

1. **赛道 name 必须是这 5 个之一**（或网页里已存在的赛道名）：
   `家纺` / `生活日用-清洁工具` / `生活日用-功效品` / `生活日用-收纳` / `餐厨水具`。
   不在列表里的会作为**新赛道**加入（AI 应先与同学确认赛道名是否正确）。
2. `merge_into_creative.py` 只覆盖 6 个模块字段，**topMaterials / videoUrl / frames / golden5 等一律保留**。
3. 权重是 0-100 的相对大小（词云字号），第一个最核心卖点词给 100，其余按重要度递减。
4. 给了消耗 CSV 时，**先分析再落数**：算加权/官方口径均值、按客户消耗挑 Top、甄别是否有跨品类素材混入。
5. AI 直写数据源前，务必在本地 http server 预览确认；`--push` 是"上线"动作，确认后再执行。
