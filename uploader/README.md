# 日百看板 · 在线上传 + AI 产出 + 审核上线（Vercel 后端）

这是给看板配套的「同事在线传 Excel → AI 自动产出分析 → 管理员审核 → 自动上线」后端。

```
同事打开上传页 → 传赛道 Excel + 填赛道名
   → 后端解析 Excel → 调 AI 产出 track JSON → 存入待审核区（GitHub pending/ 目录）
你打开审核页 → 预览 AI 产出 → 点【通过】
   → 后端把该赛道合并进 site/data/creative.js 并 push
   → GitHub Pages 几十秒后自动刷新看板
```

看板本体（GitHub Pages）不变，本后端只负责「收数据 + 跑 AI + 审核 + 写回」。

---

## 一、目录结构

```
uploader/
├── api/
│   ├── _lib.js        # 共享库：GitHub读写 / creative.js解析合并 / AI调用 / 鉴权
│   ├── _prompt.js     # AI 提示词（固化了 schema 规范）
│   ├── upload.js      # POST 收Excel→调AI→存待审核区
│   ├── pending.js     # GET  列待审核记录
│   ├── approve.js     # POST 通过→合并进creative.js并推送
│   └── reject.js      # POST 驳回→删待审记录
├── public/
│   ├── upload.html    # 同事用：上传页
│   └── review.html    # 你用：审核页
├── package.json
└── vercel.json
```

---

## 二、部署步骤（一次性，约 5 分钟）

### 1. 把本目录推到一个 GitHub 仓库
可以单独建个仓库，也可以就用现在这个 `riri-baihuo-board`（本 uploader 目录已在其中）。

### 2. 在 Vercel 导入项目
1. 打开 https://vercel.com → 用 GitHub 登录
2. Add New → Project → 选中仓库
3. **Root Directory 选 `uploader`**（重要：因为后端在这个子目录）
4. 先别急着 Deploy，去配环境变量 ↓

### 3. 配置环境变量（Vercel → Settings → Environment Variables）

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GH_TOKEN` | GitHub Token（能读写看板仓库） | `ghp_xxx` |
| `GH_OWNER` | 看板仓库所有者 | `cccccccoingjiang77` |
| `GH_REPO` | 看板仓库名 | `riri-baihuo-board` |
| `GH_BRANCH` | 分支 | `main` |
| `CREATIVE_PATH` | creative.js 路径 | `site/data/creative.js` |
| `AI_BASE_URL` | AI 接口地址（OpenAI 兼容） | 见下 |
| `AI_API_KEY` | AI 密钥 | `sk-xxx` |
| `AI_MODEL` | 模型名 | 见下 |
| `UPLOAD_TOKEN` | 上传口令（发给同事） | 自定义，如 `ricao2026` |
| `ADMIN_TOKEN` | 审核口令（你自己留着） | 自定义，如 `admin888` |

**AI 供应商怎么填（三选一，都是 OpenAI 兼容格式）：**

- OpenAI：`AI_BASE_URL=https://api.openai.com/v1`，`AI_MODEL=gpt-4o-mini`
- DeepSeek：`AI_BASE_URL=https://api.deepseek.com/v1`，`AI_MODEL=deepseek-chat`
- 阿里通义：`AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`，`AI_MODEL=qwen-plus`

> 换供应商只需改这 3 个变量，代码不用动。

### 4. Deploy
部署完成后会得到一个网址，如 `https://riri-baihuo-uploader.vercel.app`

- **上传页（发给同事）**：`https://<你的域名>/` 或 `/upload.html`
- **审核页（你自己用）**：`https://<你的域名>/review.html`

---

## 三、日常使用

**同事**：打开上传页 → 填上传口令 + 赛道名 → 传 Excel → 提交（会看到 AI 产出预览）
**你**：打开审核页 → 填审核口令 → 加载待审 → 逐条看预览 → 通过 / 驳回

通过后看板自动更新，**不同榜单、不同赛道各自随时更新，互不干扰，无需你手动组装**。

---

## 四、安全说明

- `topMaterials`（Top素材拆解）、`videoUrl`、关键帧等网页侧字段：合并时**只覆盖 6 个分析模块，其余原样保留**，同事上传不会冲掉已有的 Top 素材。
- 上传口令 / 审核口令分离：同事只能传（进审核区），只有你能让数据真正上线。
- AI 的 Key、GitHub Token 都只存在 Vercel 后端环境变量里，**不出现在前端页面**。
