# BiliTA 框架套用指南（给 GLMAI 或任何新 AI 应用）

BiliTA（全称 BiliBiliToyAi）是一个**单文件 AI 应用框架**：整包只有一个 `index.html`，
不依赖构建工具、不依赖外部脚本。把它复制一份、改掉配置区，就能变成一个全新的 AI 应用
（例如 GLMAI），再走一次 Toy 发布流程即可上线。

## 一、最小套用步骤（5 分钟）

1. 复制 `index.html` 到新目录。
2. 打开文件，找到 `const CONFIG = {`（约 1120 行）：
   - `VERSION`：改成你自己的版本号
   - `API_KEY`：填你自己的智谱 Key（**对外发布前务必清空**，见下文「安全」）
   - `DEFAULT_MODEL`：默认模型 key
   - `THEME`：`'auto'` 按月份自动换季 / `'winter'` 蓝白 / `'summer'` 暖橙
   - `CHANNEL / RELAY / RELAY_TOKEN`：连接方式，默认直连即可
3. 找到 `const BRAND = {`（如有）或直接全局替换品牌名：
   - `<title>`、页面里所有 `BiliTA`、人格名 `PERSONAS`
4. 改 `SUGGESTIONS`（四张快捷卡片）与 `PERSONAS`（人格），换成你的场景话术。
5. 本地双击打开自测 → `toy create/update` 发布。

## 二、配置区速查

| 配置 | 位置 | 作用 |
|---|---|---|
| `CONFIG` | `const CONFIG = {...}` | 版本、Key、模型、主题、通道 |
| `MODELS` | `const MODELS = {...}` | 模型清单；`hidden: true` 的只在旧版工具箱可见 |
| `PERSONAS` | `const PERSONAS = {...}` | 人格：名字、emoji、system prompt |
| `SUGGESTIONS` | `const SUGGESTIONS = [...]` | 空态页四张快捷卡片 |
| `SEASONS / THEME` | CSS 变量 + `html[data-season]` | 季节主题色 |
| `DEVICE_PROFILES` | `const DEVICE_PROFILES = {...}` | 手机/平板/桌面/TV 布局档位 |

## 三、内置能力清单（开箱即用，无需申请额外权限）

- 多会话管理（本地 30 个，自动迁移旧数据）
- 圆桌讨论：三个视角一题三答（`ROUND_ROLES` 可自定义角色）
- 创作四件套：标题/简介/弹幕/封面一次生成（`KIT_SYS` 控制输出格式）
- 发图片看图：GLM-4V 视觉模型，失败自动降级纯文字
- 流式增量渲染（长回答不卡）、多端布局自适应、季节主题、退出兜底
- Toy SDK：登录授权、云存储偏好、内容安全检查、退出关闭

## 四、安全红线

- `CONFIG.API_KEY` 是**前端可见**的。对外发布前要么清空（用户自带 Key / 走演示模式），
  要么只放可随时吊销的专用 Key。
- 更稳的方案：`CHANNEL: 'relay'` + 自己部署 `worker.js`（Cloudflare Worker），
  Key 存在 Worker 的 Secret 里，前端不带 Key。
- 用户输入默认会过 `toy.checkInputSafety`（App 内生效，Web 端自动放行）。

## 五、发布到 B站 Toy

```bash
toy create <目录>        # 首次创建并提交审核
toy update <id> <目录> --yes   # 后续更新
```

打包内容只有一个 `index.html`，当前体积约 150KB（远低于 50MB 限制）。

## 六、协议

MIT。基于本项目派生（如 GLMAI）请保留 LICENSE 与原仓库链接。
