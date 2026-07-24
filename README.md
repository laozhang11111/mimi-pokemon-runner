# 像素洗翠小跑者

一个带 SQLite 记分的网页小游戏。玩家控制紫衣像素小女孩，在洗翠氛围的小路上躲避依次出现的真实全国图鉴宝可梦 sprite，收集精灵球回血。

## 玩法

- 方向键或 WASD：上下左右移动
- 初始生命：10 滴血
- 宝可梦按全国图鉴编号从 #0001 到 #1025 依次出现
- 成功通过一只宝可梦：得 1 分
- 满分：1025 分
- 碰到宝可梦：生命 -1，并短暂无敌
- 碰到精灵球：生命 +1，最多 10 滴血
- 生命归零或满分通关后，最终得分会写入 SQLite

## 运行

在本文件夹中执行：

```bash
npm start
```

然后打开 `http://localhost:5173`。

成绩数据库会自动创建在 `data/scores.db`。

## 素材

- 主角图片：`image/player.png`
- 宝可梦图鉴数据：`image/pokedex.json`
- 宝可梦图片：`image/pokemon-0001.png` 到 `image/pokemon-1025.png`
- 重新下载素材：`npm run assets`

## GitHub 自动部署

推送到 `main` 分支后，GitHub Actions 会把项目打包上传到腾讯云服务器，并重启 `pixel-hisui-runner` 服务。

仓库 Secrets 需要配置：

- `SERVER_HOST`：腾讯云公网 IP
- `SERVER_USER`：服务器用户名，例如 `root`
- `SERVER_PORT`：SSH 端口，通常是 `22`
- `SERVER_SSH_KEY`：允许登录服务器的部署私钥
