/**
 * 卖点 & 创意分析数据层（Creative Board）
 * ============================================================
 * 【多人协作填充区】每个赛道一个对象，字段结构完全一致。
 * 页面逻辑不依赖具体内容，运营/分析同学按结构增删改即可。
 *
 * ── 赛道对象字段 ────────────────────────────────────────────
 *  key/name        赛道标识/名称
 *  metrics         赛道指标均值 {creativeCount, ctr, play3s, cvr, cpm}
 *                   creativeCount 本期创意条数
 *                   ctr           点击率(%)
 *                   play3s        3s完播率(%)
 *                   cvr           转化率(%)
 *                   cpm           CPM(元)
 *  sellingWords    卖点词云 [{word, weight}]  weight越大字越大越居中
 *  sellingContext  卖点动因/背景卖点 [{driver, need, words[]}]（可选）
 *                   driver 触发动因（时令/换季/场景/情绪等背景因素）
 *                   need   由动因转化出的真实需求
 *                   words  可直接落到创意里的支撑卖点词
 *  painWords       用户痛点词 [{word, weight}]（可选）
 *  scripts         常见爆款话术 [string]（≥2条素材出现的高转化话术）
 *  keyPoints       跑量关键点 [{title, desc}]  4维度：钩子对比/节点痛点/福利紧迫/明星IP
 *  topMaterials    Top素材拆解 [material]
 *
 * ── material（Top素材）字段 ─────────────────────────────────
 *  rank, title, product, tag(如"产品展示"), roi, ctr, cvr, cpm
 *  duration(如"18.5s"), videoUrl(原片), frames[](关键帧图URL数组)
 *  golden5:  黄金五段式 {
 *     hook:{time,desc}, pain:{time,desc}, cure:{time,desc},
 *     demo:{time,desc}, ending:{time,desc} }
 * ============================================================
 */
window.CREATIVE_DATA = {
  meta: { period: "2026年7月", updatedAt: "2026-07-14", owner: "创意分析组" },

  tracks: [
    /* ============ 赛道1：家纺 ============ */
    {
      key: "hf",
      name: "家纺",
      owner: "待分配",
      metrics: { creativeCount: 128, ctr: 3.6, play3s: 62, cvr: 4.1, cpm: 68 },
      sellingWords: [
        { word: "冰丝凉感", weight: 100 }, { word: "裸睡级柔滑", weight: 92 },
        { word: "亲肤透气", weight: 85 }, { word: "A类母婴级", weight: 80 },
        { word: "四季通用", weight: 72 }, { word: "水洗不缩水", weight: 68 },
        { word: "高支高密", weight: 64 }, { word: "深睡记忆枕", weight: 60 },
        { word: "抗菌防螨", weight: 58 }, { word: "工厂直发", weight: 54 },
        { word: "云朵般柔软", weight: 50 }, { word: "高级绣花", weight: 46 },
        { word: "夏凉被", weight: 44 }, { word: "轻奢质感", weight: 40 },
        { word: "不起球", weight: 36 }, { word: "大牌平替", weight: 32 }
      ],
      painWords: [
        { word: "睡觉出汗黏腻", weight: 90 }, { word: "被子太热", weight: 80 },
        { word: "枕头塌陷", weight: 70 }, { word: "掉色起球", weight: 60 },
        { word: "螨虫过敏", weight: 55 }, { word: "颈椎不适", weight: 50 }
      ],
      sellingContext: [
        { driver: "三伏高温·湿热难眠", need: "夜里燥热出汗，想要物理降温、贴身凉爽的寝具",
          words: ["冰丝凉感", "夏凉被", "裸睡级柔滑", "亲肤透气"] },
        { driver: "梅雨返潮·螨虫滋生", need: "潮湿闷热催生螨虫过敏，需要抗菌防螨、可水洗的健康床品",
          words: ["抗菌防螨", "水洗不缩水", "A类母婴级"] },
        { driver: "换季更替·一被难两用", need: "季节切换重复买寝具浪费，想要四季通用、一被多穿",
          words: ["四季通用", "高支高密", "深睡记忆枕"] }
      ],
      scripts: [
        "夏天盖它凉飕飕，一整晚不出汗", "裸睡级顺滑，贴身像丝一样",
        "工厂直发，比商场便宜一半", "A类母婴级，宝宝也能盖",
        "一张顶三张，四季都能用", "记忆枕托住颈椎，一觉睡到天亮"
      ],
      keyPoints: [
        { title: "钩子/强对比", desc: "开场用『普通被 vs 冰丝被』触感对比、泼水实验展示凉感与透气，3秒抓眼球。" },
        { title: "节点/季节痛点", desc: "紧扣夏至三伏『睡觉出汗黏腻』痛点，秋冬切『被子不够暖』，季节切换话术。" },
        { title: "福利/紧迫", desc: "工厂直发/大牌平替价格锚定 + 限时立减，凸显性价比与紧迫感。" },
        { title: "明星/IP", desc: "达人/素人真实试睡测评背书，弱明星强『真实体验』信任链。" }
      ],
      topMaterials: [
        {
          rank: 1, title: "冰丝凉感三件套·泼水实验", product: "夏季冰丝凉感三件套",
          tag: "产品展示", roi: 2.9, ctr: 4.2, cvr: 5.9, cpm: 66, duration: "22.5s",
          videoUrl: "", frames: [],
          golden5: {
            hook: { time: "0-3S", desc: "『这被子居然能泼水不透』——泼水实验+字幕直给，制造好奇钩子。" },
            pain: { time: "3-10S", desc: "对比普通棉被睡觉出汗黏腻的痛点特写，放大三伏天燥热体验。" },
            cure: { time: "10-25S", desc: "冰丝面料特写+凉感数据字幕，建立『物理降温』的解药认知。" },
            demo: { time: "25-90S", desc: "上身试睡演示柔滑贴肤、透气过程，配合卧室场景。" },
            ending: { time: "90S+", desc: "工厂直发+限时立减收尾，强化性价比促下单。" }
          }
        }
      ]
    },

    /* ============ 赛道2：生活日用-清洁工具 ============ */
    {
      key: "clean",
      name: "生活日用-清洁工具",
      owner: "待分配",
      metrics: { creativeCount: 156, ctr: 4.8, play3s: 58, cvr: 6.3, cpm: 71 },
      sellingWords: [
        { word: "免手洗", weight: 100 }, { word: "一擦即净", weight: 94 },
        { word: "强力去污", weight: 88 }, { word: "懒人神器", weight: 82 },
        { word: "不脏手", weight: 76 }, { word: "360°旋转", weight: 70 },
        { word: "吸水不掉毛", weight: 66 }, { word: "电动省力", weight: 62 },
        { word: "厨房重油污", weight: 58 }, { word: "一次性方便", weight: 54 },
        { word: "秒干", weight: 50 }, { word: "抗菌超细纤维", weight: 46 },
        { word: "大容量装", weight: 42 }, { word: "缝隙也能擦", weight: 38 },
        { word: "工厂价", weight: 34 }
      ],
      painWords: [
        { word: "拖地弯腰累", weight: 90 }, { word: "抹布越擦越脏", weight: 82 },
        { word: "油污擦不掉", weight: 74 }, { word: "手泡水里恶心", weight: 66 },
        { word: "掉毛留痕", weight: 58 }, { word: "缝隙够不着", weight: 50 }
      ],
      sellingContext: [
        { driver: "梅雨/回南天·地面返潮", need: "地面反复湿滑难干，需要吸水快干、免手洗的清洁工具",
          words: ["吸水不掉毛", "秒干", "免手洗"] },
        { driver: "三伏厨房·重油污爆发", need: "高温下厨房油烟重、油污顽固，想要强力去污、不脏手",
          words: ["厨房重油污", "强力去污", "不脏手"] },
        { driver: "懒人/快节奏·嫌打扫麻烦", need: "上班族没时间精细打扫，追求省力高效、一步到位",
          words: ["懒人神器", "电动省力", "360°旋转", "一擦即净"] }
      ],
      scripts: [
        "好用又便宜，用过的都说好", "免手洗，脏水一按就走",
        "厨房油污一擦就掉，不费劲", "懒人必备，拖地再也不弯腰",
        "工厂直发不涨价", "一次性的，用完就扔超方便"
      ],
      keyPoints: [
        { title: "钩子/强对比", desc: "开场用『糖浆/污渍一拖即净』强视觉冲击，胶棉挤水前后地面反差极大，即时效果制造好奇。" },
        { title: "节点/季节痛点", desc: "梅雨/回南天地面湿滑、三伏厨房油腻，绑定季节场景痛点放大『难打理』焦虑。" },
        { title: "福利/紧迫", desc: "价格锚定『199降到159』限时立减 + 『灵活旋转关节/360°全包挤水』功能溢价，凸显划算与紧迫。" },
        { title: "明星/IP", desc: "宝家洁 × 杨幂『品牌全球代言人』强背书，明星信任链 + 达人真实居家场景实拍，显著提升点击与转化。" }
      ],
      topMaterials: [
        {
          rank: 1, title: "宝家洁挤水胶棉拖把 · 杨幂代言｜一拖即净演示", product: "宝家洁 对折挤水胶棉拖把",
          tag: "明星代言 · 产品演示", roi: 2.8, ctr: 5.6, cvr: 7.4, cpm: 70, duration: "204s",
          videoUrl: "assets/media3.mp4",
          frames: [
            "assets/frames/m3_1_hook.jpg",
            "assets/frames/m3_2_pain.jpg",
            "assets/frames/m3_3_cure.jpg",
            "assets/frames/m3_4_demo1.jpg",
            "assets/frames/m3_5_demo2.jpg",
            "assets/frames/m3_6_ending.jpg"
          ],
          golden5: {
            hook: { time: "0-3S", desc: "居家高级场景 + 人设自白『我是一个特别爱干净的人』，先建立生活方式认同，柔性钩子拉住爱干净人群。" },
            pain: { time: "3-12S", desc: "切卫生间地面污渍/糖浆场景，放大『地面难打理、拖不干净』痛点，反转为『反而觉得是种乐趣』埋伏笔。" },
            cure: { time: "12-45S", desc: "玫红胶棉拖把上场，糖浆污渍一拖即净 + 价格锚点『199降到159』字幕直给，建立『高效+划算』解药认知。" },
            demo: { time: "45-150S", desc: "客厅/卫生间/水池多场景实拍演示，凸显『灵活旋转的关节』贴边清洁，叠加『宝家洁全球代言人杨幂推荐』明星背书。" },
            ending: { time: "150-204S", desc: "特写『360°全包裹挤水式设计』免手脏挤水收尾，强化核心卖点差异点促下单。" }
          }
        }
      ]
    },

    /* ============ 赛道3：生活日用-功效品 ============ */
    {
      key: "func",
      name: "生活日用-功效品",
      owner: "待分配",
      metrics: { creativeCount: 98, ctr: 4.1, play3s: 55, cvr: 5.5, cpm: 74 },
      sellingWords: [
        { word: "深层除螨", weight: 100 }, { word: "一喷即净", weight: 92 },
        { word: "去油污", weight: 86 }, { word: "除菌99%", weight: 80 },
        { word: "去异味", weight: 74 }, { word: "泡沫型", weight: 68 },
        { word: "免冲洗", weight: 62 }, { word: "植物配方", weight: 58 },
        { word: "温和不伤手", weight: 54 }, { word: "重油污克星", weight: 50 },
        { word: "水垢一擦光", weight: 46 }, { word: "大瓶量足", weight: 42 },
        { word: "母婴可用", weight: 38 }
      ],
      painWords: [
        { word: "床上螨虫", weight: 88 }, { word: "厨房油腻", weight: 80 },
        { word: "浴室水垢", weight: 72 }, { word: "异味难去", weight: 64 },
        { word: "普通清洁剂伤手", weight: 56 }
      ],
      sellingContext: [
        { driver: "三伏养生·防潮除湿祛味", need: "三伏湿热易滋生螨虫细菌异味，养生防护意识拉满，想要除菌除螨、清爽祛味",
          words: ["深层除螨", "除菌99%", "去异味"] },
        { driver: "梅雨返潮·霉菌水垢滋生", need: "回南天潮湿霉味重、浴室水垢结垢，需要一喷即净、免冲洗高效清洁",
          words: ["一喷即净", "水垢一擦光", "免冲洗"] },
        { driver: "健康焦虑·母婴/敏感人群", need: "担心化学残留伤手伤娃，倾向植物温和、母婴可用的成分",
          words: ["植物配方", "温和不伤手", "母婴可用"] }
      ],
      scripts: [
        "一喷一擦，油污全没了", "床上螨虫看得见的干净",
        "植物配方，母婴也能用", "水垢一擦就光，不用使劲搓",
        "大瓶量足，用很久", "效果太猛了，相见恨晚"
      ],
      keyPoints: [
        { title: "钩子/强对比", desc: "显微镜下螨虫/油污前后对比可视化，痛点直击制造冲击。" },
        { title: "节点/季节痛点", desc: "三伏/梅雨绑定除菌除味防螨，换季大扫除绑定重油污清洁。" },
        { title: "福利/紧迫", desc: "买一送一/大瓶装限时优惠，凸显量足划算与紧迫。" },
        { title: "明星/IP", desc: "实验室/成分溯源背书，强『看得见的效果』信任建立。" }
      ],
      topMaterials: [
        {
          rank: 1, title: "除螨喷雾·显微镜可视化", product: "除螨喷雾 500ml*2",
          tag: "产品展示", roi: 2.4, ctr: 4.6, cvr: 6.0, cpm: 73, duration: "20.0s",
          videoUrl: "", frames: [],
          golden5: {
            hook: { time: "0-3S", desc: "显微镜下床单螨虫画面+字幕『你的床有多脏』钩子。" },
            pain: { time: "3-10S", desc: "过敏、皮肤瘙痒痛点放大，激起焦虑与需求。" },
            cure: { time: "10-25S", desc: "一喷即净+植物配方特写，建立『安全高效』解药认知。" },
            demo: { time: "25-90S", desc: "床品/沙发多场景喷洒演示与前后对比。" },
            ending: { time: "90S+", desc: "买一送一限时+母婴可用收尾促转化。" }
          }
        }
      ]
    },

    /* ============ 赛道4：生活日用-收纳 ============ */
    {
      key: "store",
      name: "生活日用-收纳",
      owner: "待分配",
      metrics: { creativeCount: 112, ctr: 3.9, play3s: 60, cvr: 4.8, cpm: 63 },
      sellingWords: [
        { word: "大容量", weight: 100 }, { word: "省空间", weight: 94 },
        { word: "真空压缩", weight: 86 }, { word: "可折叠", weight: 80 },
        { word: "分层收纳", weight: 74 }, { word: "免打孔", weight: 68 },
        { word: "透明可视", weight: 62 }, { word: "承重加固", weight: 58 },
        { word: "桌面整理", weight: 54 }, { word: "衣柜扩容", weight: 50 },
        { word: "北欧简约", weight: 46 }, { word: "多规格", weight: 42 },
        { word: "组合套装", weight: 38 }
      ],
      painWords: [
        { word: "衣柜塞不下", weight: 88 }, { word: "东西乱找不到", weight: 80 },
        { word: "桌面凌乱", weight: 72 }, { word: "换季被子占地", weight: 64 },
        { word: "收纳盒不结实", weight: 56 }
      ],
      sellingContext: [
        { driver: "换季更替·冬夏物大挪移", need: "夏天要收冬被腾空间，换季集中整理，想要真空压缩、省空间扩容",
          words: ["真空压缩", "省空间", "衣柜扩容", "换季收纳"] },
        { driver: "开学季/暑期出游·打包整理", need: "开学住宿、出游打包需要快速归类，追求可折叠、便携分层的快捷收纳",
          words: ["可折叠", "分层收纳", "组合套装"] },
        { driver: "租房/小户型·空间紧张", need: "房子小又不能打孔，需要免打孔、大容量、透明可视好找",
          words: ["免打孔", "大容量", "透明可视", "承重加固"] }
      ],
      scripts: [
        "一个顶三个，衣柜瞬间大一倍", "真空一压，被子只剩薄薄一片",
        "分格设计，找东西一目了然", "免打孔，租房也能用",
        "承重加固，站上去都不塌", "组合装超划算，全屋整理一步到位"
      ],
      keyPoints: [
        { title: "钩子/强对比", desc: "『真空压缩前后体积对比』『凌乱vs整齐』强视觉反差钩子。" },
        { title: "节点/季节痛点", desc: "换季收纳（夏物/冬被）、开学季宿舍整理绑定季节需求。" },
        { title: "福利/紧迫", desc: "组合套装限时优惠+『拍1得N件』凸显划算与紧迫。" },
        { title: "明星/IP", desc: "家居博主/收纳达人实拍整理过程背书，强实用心智。" }
      ],
      topMaterials: [
        {
          rank: 1, title: "真空压缩袋·体积对比演示", product: "大容量真空压缩收纳袋 6件套",
          tag: "产品展示", roi: 2.3, ctr: 4.3, cvr: 5.2, cpm: 62, duration: "16.0s",
          videoUrl: "", frames: [],
          golden5: {
            hook: { time: "0-3S", desc: "『一床被子压成一本书厚』体积对比钩子，视觉冲击强。" },
            pain: { time: "3-10S", desc: "衣柜塞满、换季被子无处放的痛点场景放大。" },
            cure: { time: "10-25S", desc: "真空压缩原理+抽气演示，建立『省空间』解药认知。" },
            demo: { time: "25-90S", desc: "多规格套装实测衣柜扩容前后对比。" },
            ending: { time: "90S+", desc: "组合套装限时+送抽气泵收尾促下单。" }
          }
        }
      ]
    },

    /* ============ 赛道5：餐厨水具 ============ */
    {
      key: "kitchen",
      name: "餐厨水具",
      owner: "待分配",
      metrics: { creativeCount: 134, ctr: 3.5, play3s: 57, cvr: 4.5, cpm: 70 },
      sellingWords: [
        { word: "不粘锅", weight: 100 }, { word: "食品级材质", weight: 92 },
        { word: "耐高温", weight: 84 }, { word: "轻巧好清洗", weight: 78 },
        { word: "茶水分离", weight: 72 }, { word: "保温保鲜", weight: 66 },
        { word: "一体成型", weight: 60 }, { word: "无涂层健康", weight: 56 },
        { word: "高颜值", weight: 52 }, { word: "大容量", weight: 48 },
        { word: "耐摔玻璃", weight: 44 }, { word: "成套礼盒", weight: 40 },
        { word: "男士商务", weight: 36 }
      ],
      painWords: [
        { word: "锅底糊粘", weight: 86 }, { word: "刷锅费劲", weight: 78 },
        { word: "涂层脱落", weight: 70 }, { word: "泡茶烫手", weight: 62 },
        { word: "保鲜盒漏水", weight: 54 }
      ],
      sellingContext: [
        { driver: "夏季消暑·冰饮保鲜需求旺", need: "夏天爱喝冰饮、囤鲜食，需要保温保鲜、耐摔轻巧的水具容器",
          words: ["保温保鲜", "耐摔玻璃", "大容量", "茶水分离"] },
        { driver: "健康饮食·怕涂层伤身", need: "越来越在意锅具健康，担心涂层脱落，倾向无涂层、食品级材质",
          words: ["无涂层健康", "食品级材质", "不粘锅"] },
        { driver: "中秋国庆·聚会送礼场景", need: "节庆聚餐、走亲送礼旺季，想要高颜值成套、有面子的礼盒装",
          words: ["成套礼盒", "高颜值", "男士商务"] }
      ],
      scripts: [
        "煎蛋不粘锅，一滑就出来", "食品级材质，用着安心",
        "茶水分离，不烫手不苦涩", "轻轻一冲就干净，刷锅不费劲",
        "高颜值成套，送礼有面子", "耐高温耐摔，用很久不坏"
      ],
      keyPoints: [
        { title: "钩子/强对比", desc: "『煎蛋一滑就出/普通锅糊底』不粘效果强对比钩子。" },
        { title: "节点/季节痛点", desc: "中秋国庆聚会绑定成套餐具礼赠，夏季绑定冰饮保鲜水具。" },
        { title: "福利/紧迫", desc: "成套礼盒限时+加赠锅铲，凸显划算与送礼心智紧迫。" },
        { title: "明星/IP", desc: "厨房达人实测煎炒背书，中高客单绑定『男士商务』人群。" }
      ],
      topMaterials: [
        {
          rank: 1, title: "陶瓷不粘锅·煎蛋滑动演示", product: "陶瓷不粘炒锅",
          tag: "产品展示", roi: 2.2, ctr: 3.9, cvr: 4.8, cpm: 69, duration: "19.0s",
          videoUrl: "", frames: [],
          golden5: {
            hook: { time: "0-3S", desc: "『煎蛋一滑就出锅』不粘特写钩子，即时效果制造好奇。" },
            pain: { time: "3-10S", desc: "普通锅糊底、刷锅费劲、涂层脱落的痛点放大。" },
            cure: { time: "10-25S", desc: "陶瓷无涂层/食品级材质特写，建立『健康不粘』解药。" },
            demo: { time: "25-90S", desc: "煎炒实拍+轻松清洗演示，多菜品场景展示。" },
            ending: { time: "90S+", desc: "成套礼盒限时+加赠锅铲收尾促下单。" }
          }
        }
      ]
    }
  ]
};
