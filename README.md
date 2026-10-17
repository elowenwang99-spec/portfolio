# 个人作品集

一个奶油色系、手写信纸质感的单页个人作品集网站。面向 HR / 面试官，内容整理自简历。

**主线**：打开信封（封面）→ 一页页展开信纸（经历）→ 回信（联系方式）。

## 怎么本地看

在项目根目录执行：

```bash
python3 -m http.server 8787
```

然后打开 <http://127.0.0.1:8787/>。

> 直接双击 `index.html` 也能看，但建议用上面的方式（字体、下载链接在 `file://` 下会有限制）。

## 目录结构

```
.
├── index.html                  页面本体（所有文案都在这里，中英文用 <span class="zh"> / <span class="en"> 包着）
├── assets/
│   ├── css/
│   │   ├── fonts.css           自动生成，勿手改
│   │   └── style.css           全部样式，开头是设计变量（配色 / 字体 / 阴影）
│   ├── fonts/                  自托管字体（1.1 MB，已按页面用字裁剪）
│   ├── img/                    图片放这里（目前都是占位）
│   ├── js/main.js              中英切换 / 封面隐藏导航 / 导航高亮 / 滚动进场 / 回顶部
│   └── resume-wangjinghan.pdf  简历 PDF（上线前请自己确认要不要公开）
├── preview/                    预览截图
├── tools/build-fonts.py        字体子集化脚本
└── 待补充素材清单.md            还缺哪些图片素材
```

## 页面结构

| 区块 | id | 说明 |
| --- | --- | --- |
| 封面 | `#cover` | 信封 + `WELCOME TO MY CHANNEL`，此时顶部导航隐藏 |
| 基本信息 | `#about` | 左拍立得 + 右自我介绍与信息表，下面接荣誉勾选清单 |
| 个人经历 | `#experience` | 三段经历，每段是一张信纸，随滚动「一页页展开」 |
| 专业技能 | `#skills` | 六张索引卡 |
| 生活记录 | `#life` | 拍立得墙 |
| 联系方式 | `#contact` | 一封回信（信封折线 + 邮票 + 火漆印） |

## 常用操作

**改配色**：打开 `assets/css/style.css`，最上面 `:root` 里都是变量。
- `--desk` 是桌面底色，`--sheet` 是信纸，`--paper` 是纸上的卡片
- 点缀色：`--matcha / --apricot / --blush / --mist / --lilac`
- `--seal` 是火漆印颜色

**改文案**：直接在 `index.html` 里找对应文字，中文在 `class="zh"` 的 span 里，英文在 `class="en"` 里。两边都要改，否则切换语言时会露出另一版。
> 例外：封面那两行 `WELCOME TO MY CHANNEL` / `NICE TO MEET YOU` 中英模式都是英文，写死的。

**改完文案后重建字体**（页面新增了用到的汉字就必须跑，否则新字会掉回系统字体）：

```bash
python3 tools/build-fonts.py
```

**换图片**：把图放进 `assets/img/`，然后替换 `index.html` 里的 `.photo-empty` 占位块。

**调经历展开动画**：`style.css` 里搜 `sheet-unfold`。这个动画靠 Chrome 的滚动时间轴（`animation-timeline: view()`）驱动，串在滚动条上，不支持的浏览器会自动退回普通淡入（`main.js` 里做了判断）。

## 调试小开关

- `?lang=en` 直接用英文打开
- `?anim=0` 关掉所有进场动画（截图 / 导出用）

## 部署

纯静态，把整个目录丢到 GitHub Pages / Vercel / Netlify 都行，不需要构建步骤。

## 字体出处

- 中文标题与强调：霞鹜文楷 Screen（SIL OFL 1.1）
- 封面马克笔标题：Caveat Brush（SIL OFL 1.1）
- 英文手写：Caveat、Patrick Hand（SIL OFL 1.1）
