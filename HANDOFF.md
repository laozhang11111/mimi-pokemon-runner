# 张米米宝可梦横版躲避游戏交接文档

最后更新：2026-07-24

本文档只负责旧版“横版躲避游戏”，也就是 `mimi.zhangduotian.site` 对应的玩法。它整理了本游戏从最初需求到当前实现状态的关键上下文、部署方式、文件结构和后续维护注意事项。

## 1. 项目概览

- 项目名称：张米米宝可梦横版躲避游戏
- 项目类型：网页 Canvas 横版躲避小游戏
- 当前独立归档路径：`/Users/zhangduotian/Documents/Codex/2026-07-22/users-zhangduotian-documents-codex-2026-06/mimi-pokemon-runner`
- GitHub 独立仓库：`laozhang11111/mimi-pokemon-runner`
- 历史来源：原 `pixel-hisui-runner` 仓库提交 `86f01a0`（2026-07-10，对战游戏改造前的完整横版游戏）
- 线上域名：`http://mimi.zhangduotian.site`
- 服务器：腾讯云轻量应用服务器，曾使用公网 IP `82.156.208.87`
- 运行端口：Node 服务默认 `5173`
- 数据库：SQLite，文件为 `data/scores.db`

游戏核心是：玩家控制家庭角色躲避宝可梦，收集精灵球回血，通过宝可梦得分，最终得分写入 SQLite 排行榜。

## 2. 与宝可梦对战游戏的边界

这是一款独立游戏，不是 `zhangduotian.site/duizhan/` 的子模块，也不是宝可梦对战项目的旧页面。

| 项目 | 本游戏：横版躲避 | 另一个游戏：宝可梦像素对战 |
| --- | --- | --- |
| 线上地址 | `http://mimi.zhangduotian.site` | `https://zhangduotian.site/duizhan/` |
| GitHub 仓库 | `laozhang11111/mimi-pokemon-runner` | `laozhang11111/pixel-hisui-runner` |
| 本地目录 | `mimi-pokemon-runner` | `/Users/zhangduotian/Documents/Codex/2026-06-30/bang/pixel-hisui-runner` |
| 服务用途 | Canvas 横版躲避、排行榜 | 回合制宝可梦对战、馆主挑战、对战记录 |
| 数据 | SQLite 分数榜 | JSON 对战记录和馆主进度 |

维护或部署时不要混用两个仓库的工作目录、服务目录、GitHub Actions 密钥、Nginx 配置和 systemd 服务。旧版横版躲避游戏的内容不要被宝可梦对战项目覆盖。

## 3. 用户长期偏好

用户偏好非常明确：

- 希望代码改完后直接提交并推送 GitHub，触发线上自动部署。
- 希望回答尽量用中文、少术语，给出明确操作结果。
- 视觉上偏好清晰的像素风，类似星露谷物语，不要模糊、不要我的世界块状风。
- 角色贴图尤其重视比例统一：同一个角色不同方向的头部大小应一致。
- 用户经常会基于截图反馈视觉问题，优先按截图调整。
- 用户不喜欢无效按钮或不可点击 UI，看到就希望删掉或改成可用入口。

## 4. 当前玩法规则

### 基础规则

- 初始分数：`0`
- 满分：`1025`
- 每成功通过一只宝可梦：`+1` 分
- 血量归零：失败
- 达到 `1025` 分：通关
- 碰到宝可梦：血量 `-1`
- 碰到精灵球：血量 `+1`
- 精灵球只回血，不改变分数

### 模式

首页有三个游戏入口：

- 单人模式：张米米
- 双人模式：张米米 + 老张
- 三人模式：张米米 + 老张 + 妈妈

### 血量

- 单人模式：10 点血
- 双人模式：20 点血，两个角色共享
- 三人模式：30 点血，三个角色共享

### 控制

- 张米米：`WASD`
- 老张：方向键
- 妈妈：`IJKL`
- 移动端：页面底部有虚拟上下左右键，主要控制方向键角色

### 角色速度和碰撞体积

用户要求角色速度和碰撞体积按比例：

- 张米米：基准 `1`
- 老张：`1.5`
- 妈妈：`1.25`

当前碰撞体积规则：

- 张米米：左/右 `1`，上/下 `0.5`
- 老张：左/右 `1.5`，上/下 `0.75`
- 妈妈：左/右 `1.25`，上/下 `0.625`

注意：上/下方向是跳起和蹲下动作，碰撞体积减半。

## 5. 难度设计

当前已有难度递增逻辑：

- 每经过 100 只宝可梦，整体速度和密度逐步提升。
- 小怪密度最终约提升到当前的 3 倍。
- 小怪速度最终最高约提升到当前的 3 倍。
- 随机 10% 小怪速度为当前速度 3 倍。
- 随机 10% 小怪速度为当前速度 2 倍。
- 小怪会有小范围随机上下漂移。
- 精灵球出现频率随分数逐渐降低，最终降为 0。

三人模式还有团队护盾：

- 每通过 100 个小怪可生效一次。
- 三个角色在短时间窗口内都发生碰撞时触发。
- 触发后 3 秒无敌，不扣血。
- 三个角色会进入彩色发光特效状态，持续 3 秒。

相关代码位置：`game.js` 中的 `getDifficulty()`、`maybeTriggerTeamShield()`、`drawPlayerPose()`。

## 6. 素材与角色贴图

全部素材位于：

`/Users/zhangduotian/Documents/Codex/2026-06-30/bang/pixel-hisui-runner/image`

### 张米米

- `image/player-up.png`
- `image/player-down.png`
- `image/player-left.png`
- `image/player-right.png`

角色特征：

- 紫色上衣
- 紫色裤子
- 黑发马尾
- 红领巾/红色装饰
- 小女孩像素风

### 老张

- `image/laozhang-up.png`
- `image/laozhang-down.png`
- `image/laozhang-left.png`
- `image/laozhang-right.png`

角色特征：

- 黑色短发
- 眼镜
- 红色曼联风格上衣
- 成人男性
- 身高比例参考：老张 170cm，张米米 124cm

历史调整重点：

- 老张不同方向贴图曾出现忽大忽小的问题。
- 后来修正了头部比例。
- 老张左/右贴图又按用户要求缩小了 `1.25` 倍，即显示系数 `0.8`。
- 老张蹲下贴图曾多次调整，目前在代码中有单独显示系数。

### 妈妈

- `image/mama-up.png`
- `image/mama-down.png`
- `image/mama-left.png`
- `image/mama-right.png`

角色特征：

- 女性角色
- 粉色上衣
- 深色裙子
- 长头发
- 参考照片里用户要求：脸瘦一些，头发更长一些，眼睛小一些
- 碰撞体积介于张米米和老张之间

### 首页封面

- `image/home-cover-wide.webp`

当前首页封面保留为游戏封面图，封面区域已有三个按钮：

- 单人模式
- 双人模式
- 三人模式
- 历史记录入口在同一组按钮中

### 游戏背景

当前游戏背景已改为“小朋友上学”主题：

- `image/school-drawing-bg.png`

背景来源：

- 用户提供了一张儿童画，内容包括太阳、蓝色天空/云、纸飞机、蝴蝶、几个小朋友、学校/房子。
- 先生成像素风版本给用户确认。
- 后续扩展为“几个小朋友上学”的游戏背景。
- 当前实现不是静态图单独显示，而是底图 + 动态 Canvas 元素。

动态效果包括：

- 太阳光闪动
- 蓝色云带漂移
- 纸飞机飞过
- 蝴蝶扇动
- 圆形贴纸轻微漂浮
- 小朋友循环走路
- 学校/建筑区域轻微浮动

相关代码位置：`game.js` 中的 `drawBackground()`、`drawSchoolSkyMotion()`、`drawSchoolYard()`。

## 7. 宝可梦素材与图鉴

项目当前使用真实宝可梦 sprite，不再使用原创小怪。

文件：

- 图鉴数据：`image/pokedex.json`
- 宝可梦图片：`image/pokemon-0001.png` 到 `image/pokemon-1025.png`
- 对应 SVG：`image/pokemon-0001.svg` 到后续编号

为了方便其他项目复用，后来额外整理了一个独立素材包：

- 素材包目录：`pokemon-reuse-pack/`
- 增强版图鉴：`pokemon-reuse-pack/pokedex.json`
- 表格版图鉴：`pokemon-reuse-pack/pokedex.csv`
- 原始图鉴备份：`pokemon-reuse-pack/pokedex.raw.json`
- PNG 图片目录：`pokemon-reuse-pack/images/`

增强版 `pokedex.json` 已经把身高和体重换算成更直观的单位：

- `height_dm`：原始身高，单位分米
- `height_m`：身高，单位米
- `weight_hg`：原始体重，单位 hectogram
- `weight_kg`：体重，单位千克
- `types`：属性
- `image`：素材包内图片路径

历史需求：

- 小怪必须对应实际宝可梦形象，不要乱编。
- 小怪贴图不要显示编号，要显示中文名。
- 宝可梦每局随机顺序出现。
- 每个宝可梦每局只出现一次。
- 宝可梦尺寸按真实身材比例，有大有小。

注意：

- `pokedex.json` 里有 `zhName`。
- 之前出现过所有宝可梦都显示成“宝可梦”的问题，后来修复为：先后台加载图鉴，再按 id 恢复中文名。
- 相关代码：`createPokemonDeck()`、`pokemonName()`、`hydratePokemonDeck()`。

## 8. 数据库与排行榜

数据库使用 Node 内置 SQLite API：

- 代码：`server.js`
- 数据库文件：`data/scores.db`
- API：
  - `GET /api/scores`
  - `POST /api/scores`

表结构：

```sql
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  result TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'single',
  played_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

排行榜规则：

- 只展示 Top 20。
- 按分数倒序、id 倒序。
- 记录模式：单人、双人、三人。
- 排行榜卡片有 1:1 封面图，按模式显示对应角色：
  - 单人：张米米
  - 双人：张米米 + 老张
  - 三人：张米米 + 老张 + 妈妈

相关代码：

- `server.js`
- `game.js` 中的 `saveScore()`、`loadScores()`、`scoreCard()`
- `styles.css` 中的 `.scoreboard`、`.score-cover-*`

## 9. 本地运行

在项目目录执行：

```bash
npm start
```

然后打开：

```text
http://localhost:5173
```

语法检查：

```bash
npm run check
```

当前 `package.json` 脚本：

```json
{
  "start": "node server.js",
  "assets": "node fetch-pokemon-assets.js",
  "transparent-player": "node make-player-transparent.js",
  "check": "node --check game.js && node --check server.js"
}
```

注意：项目依赖 Node 的 `node:sqlite`，线上曾使用较新 Node 版本。如果低版本 Node 报错，需要升级 Node。

## 10. 线上部署

### GitHub 自动部署

用户已经配置 GitHub Actions 自动部署。

工作流文件：

`.github/workflows/deploy.yml`

推送到 `main` 分支后，会：

1. 打包项目文件。
2. 上传到腾讯云服务器。
3. 重启 `pixel-hisui-runner` systemd 服务。

GitHub Secrets 需要：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_SSH_KEY`

### 服务器服务

服务名：

```text
pixel-hisui-runner
```

服务器上 Node 服务监听：

```text
127.0.0.1:5173
```

腾讯云服务器上 Nginx 将域名转发到本地 5173。

线上访问：

```text
http://mimi.zhangduotian.site
```

### 服务器账号与密码安全

已知服务器可能使用过以下登录账号：

- `ubuntu`
- `root`

不要把服务器明文密码写入本文件、Git 仓库、聊天记录摘要或任何可被复制分发的交接资料中。需要登录时优先使用 SSH key；如果忘记密码或需要交接权限，应在腾讯云控制台对轻量应用服务器执行“重置密码”，或更新 GitHub Actions 的部署密钥/Secrets。

部署自动化使用 GitHub Secrets 保存敏感信息，不应把 `SERVER_SSH_KEY`、服务器密码、私钥内容提交到仓库。

曾经配置过：

- `mimi.zhangduotian.site` 指向张米米游戏
- `shijiebei.zhangduotian.site` 指向另一个足球游戏或旧项目

如果线上没生效，优先排查：

1. GitHub Actions 是否成功。
2. 服务器服务是否重启成功。
3. 线上 `game.js` 是否包含最新代码。
4. 浏览器缓存，尤其手机浏览器缓存。

之前验证线上是否生效用过：

```bash
curl -L -s http://mimi.zhangduotian.site/game.js | rg -n "school-drawing-bg|drawSchoolSkyMotion"
curl -L -I http://mimi.zhangduotian.site/image/school-drawing-bg.png
```

## 11. 最近重要提交

最近提交记录：

```text
86f01a0 Add animated school route background
446f872 Scale down Lao Zhang side poses
4376845 Tune Lao Zhang crouch and team shield
615780e Speed up game start and tune crouch scale
4c1e5fd Restore crouch scale and Pokemon names
15de3e6 Normalize vertical pose scale and hitboxes
5de0ff0 Use action sprites for vertical poses
040be26 Improve vertical poses and leaderboard
b91cd09 Tune difficulty and triple shield
17d74ef Add triple player mode
b0952b1 Normalize Lao Zhang pose head scale
8387d8a Clean up Lao Zhang side sprites
```

提交含义摘要：

- `86f01a0`：新增上学路动态背景。
- `446f872`：老张左右贴图缩小。
- `4376845`：老张蹲下变大，三人护盾彩色特效。
- `615780e`：点击模式立即进入游戏，图鉴后台加载；蹲下比例微调。
- `4c1e5fd`：恢复宝可梦中文名，修复蹲下比例。
- `15de3e6`：统一上/下方向碰撞体积。
- `5de0ff0`：老张/妈妈上跳和蹲下使用动作贴图，不再只是缩放原图。
- `040be26`：排行榜展示和垂直动作贴图优化。
- `17d74ef`：增加三人模式。

## 12. 历史需求时间线摘要

### 第一阶段：单人横版游戏

最初需求：

- 做一个简单网页游戏。
- 控制一个参考照片气质设计的小女孩。
- 上下左右躲避移动小怪。
- 像冒险岛那样横版过关。
- 背景为宝可梦洗翠地区氛围。
- 路上小怪是像素风宝可梦。
- 10 滴血，碰小怪 -1，碰精灵球 +1。
- 项目文件放在一个文件夹内。

随后明确：

- 分数和血量分开。
- 初始 0 分。
- 每通过一个小怪 +1。
- 满分 1025。

### 第二阶段：真实宝可梦与 SQLite

用户补充：

- 小怪从弱到强，依次是全部宝可梦。
- 后来又改为每局随机顺序，但每个宝可梦出现一次。
- 一共 1000+ 分满分，最终确认 1025。
- 需要 SQLite 记录每次最终得分。

### 第三阶段：角色素材反复优化

用户多次提供照片或参考图，要求：

- 角色清晰，不要糊。
- 像星露谷物语，不像我的世界。
- 主角背景透明。
- 上/下/左/右都有不同姿态：
  - 上：跳跃
  - 下：蹲下
  - 左：面朝左走路
  - 右：面朝右走路
- 每张同角色贴图头部大小一致。

### 第四阶段：部署到腾讯云

用户购买腾讯云轻量应用服务器后，逐步配置：

- SSH 登录服务器。
- 上传项目。
- 运行 Node 服务。
- 配置 systemd 常驻服务。
- 开放端口。
- 配置 Nginx 转发。
- 绑定域名 `mimi.zhangduotian.site`。
- 最后改为 GitHub 自动部署。

### 第五阶段：移动端与首页封面

用户要求：

- 手机端适配。
- 增加虚拟方向键。
- 修复长按方向键导致页面选中/粘连。
- 首页使用像素风封面图。
- 首页按钮从图片里的不可点区域改成真实按钮。
- 去掉无效设置按钮。

### 第六阶段：双人和三人模式

双人模式：

- 增加老张。
- 张米米用 WASD。
- 老张用方向键。
- 共享 20 点血。

三人模式：

- 增加妈妈。
- 妈妈用 IJKL。
- 三人共享 30 点血。
- 妈妈碰撞体积介于小女孩和老张之间。

### 第七阶段：难度和护盾

用户要求：

- 难度逐步增加。
- 精灵球减少。
- 小怪更密。
- 部分小怪速度 2 倍/3 倍。
- 三人一起碰撞时，每通过 100 小怪可触发 3 秒无敌。
- 三个角色要有炫酷彩色特效。

### 第八阶段：上学路背景

用户提供儿童画：

- 太阳
- 蓝色云/天空
- 纸飞机
- 蝴蝶
- 小朋友上学
- 学校/房子

当前实现：

- 生成像素风背景图。
- 放入游戏作为背景。
- 加入动态变化层。

## 13. 关键代码位置

- `index.html`
  - 页面结构
  - 模式按钮
  - HUD
  - 排行榜容器
  - 移动端虚拟键

- `styles.css`
  - 首页封面
  - 移动端适配
  - 虚拟按钮防长按选中
  - 排行榜卡片

- `game.js`
  - 游戏主循环
  - 玩家创建
  - 输入控制
  - 难度系统
  - 宝可梦生成
  - 碰撞检测
  - 绘制背景、角色、小怪、道具
  - 排行榜展示

- `server.js`
  - 静态文件服务
  - SQLite 初始化
  - 成绩 API

- `fetch-pokemon-assets.js`
  - 宝可梦素材下载或生成相关脚本

- `generate-images.js`
  - 项目内生成图像相关脚本

- `fix-laozhang-sprites.js`
  - 老张贴图修复脚本

## 14. 维护注意事项

### 不要轻易改动角色缩放逻辑

`drawPlayerPose()` 里有针对老张、妈妈、上下左右方向的显示比例调整。它们来自大量截图反馈。改动前一定先理解当前效果。

尤其注意：

- 老张左右方向有 `0.8` 的显示缩放。
- 老张蹲下方向有单独比例。
- 妈妈蹲下方向也有单独比例。
- 上/下方向碰撞体积减半，不等于视觉贴图一定减半。

### 不要把宝可梦名字退回通用文案

`pokemonName()` 必须优先读取 `pokedex.json` 中的 `zhName`。

历史上用户明确抱怨过“怎么都叫宝可梦了”，所以要避免重犯。

### 背景要保持游戏可读性

新背景虽然丰富，但不能影响玩家看清角色和小怪。如果后续用户觉得太花，可以：

- 降低背景透明度或动态元素透明度。
- 加强路面色块对比。
- 给小怪名字标签加更深背景。

### 移动端要优先验证

用户很在意手机能玩。修改 UI 后要特别注意：

- 虚拟键不能被浏览器底部栏遮挡。
- 长按不应选中文字。
- 按键释放后不能粘连。

### 自动部署后仍可能有缓存

如果用户说线上没更新：

- 先用 `curl` 查线上 `game.js` 是否已有新代码。
- 如果有，多半是浏览器缓存。
- 如果没有，查 GitHub Actions 或服务器拉取状态。

## 15. 推荐接手流程

每次接到新需求，建议：

1. 确认需求属于视觉调整、玩法逻辑、部署问题还是素材问题。
2. 先读相关文件，不要凭空改。
3. 小范围修改。
4. 执行：

```bash
npm run check
```

5. 查看：

```bash
git diff --stat
git status --short
```

6. 用户通常希望直接上线，确认无误后：

```bash
git add ...
git commit -m "..."
git push
```

7. 告诉用户提交号和改动摘要。

## 16. 当前已知风险

- 项目没有完整自动化浏览器测试，主要靠语法检查和用户视觉确认。
- 角色贴图比例是手工调出来的，不是统一骨骼动画系统。
- 背景图是 PNG，已压到 960x540，但仍约 824KB。
- 大量宝可梦图片会增加项目体积。
- Node 的 `node:sqlite` 对 Node 版本有要求，低版本可能不支持。

## 17. 给下一个 AI 的一句话总结

这是一个用户和女儿一起玩的家庭小游戏，最重要的是“好玩、清晰、像素风、能上线”。改动时少做抽象重构，多按截图和用户反馈精确调整；提交前跑 `npm run check`，推送后告诉用户提交号。
