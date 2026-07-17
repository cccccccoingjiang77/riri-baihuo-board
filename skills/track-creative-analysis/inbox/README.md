# track-creative-analysis · inbox

赛道同学把**原始数据**或 AI 加工好的 **track JSON** 丢在这个目录。

- 原始数据（消耗 CSV / 口播文本 / 赛道理解）：随便放，AI 会来读。
- AI 加工产出的 track JSON：命名为 `XX赛道.track.json`（如 `清洁工具.track.json`）。

然后运行（把这些 track 直写进在线看板数据源）：
```bash
python3 ../scripts/merge_into_creative.py --inbox          # 合并本目录所有 *.json
python3 ../scripts/merge_into_creative.py --inbox --push   # 合并并推送上线
```

> 本目录仅作数据中转，产出的 track JSON 可保留作留档。
