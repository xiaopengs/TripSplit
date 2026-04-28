# 🧩 AA友账 TripSplit

> 旅行场景下的多人协作记账微信小程序，支持 AI 拍照识别与智能结算

## ✨ 核心功能

- **零门槛创建** — 3 秒建账本，定位自动选币种，预设影子成员
- **AI 拍照识别** — 拍小票即走，后台自动识别金额与类目
- **手动极速录入** — 半屏面板 + 大号键盘，支持简易运算
- **智能结算** — 最少转账次数算法（贪心 + 对冲优化），自动抹零
- **影子成员系统** — 旅行前预设成员，后期扫码认领无缝迁移
- **多币种支持** — CNY / JPY / USD / KRW / THB / EUR / GBP / HKD
- **离线记账** — 本地存储优先，无需注册即可使用

## 🛠 技术栈

| 层级 | 方案 |
|------|------|
| 框架 | 微信原生小程序（WXML + WXSS + JavaScript） |
| 状态管理 | 自研轻量 Store（发布订阅模式） |
| 数据存储 | 微信本地存储（云开发规划中） |
| AI 能力 | OCR 图像识别（API 对接中） |
| 测试 | 自研轻量测试框架，零依赖纯 Node.js 运行 |

## 📁 项目结构

```
TripSplit/
├── app.js/json/wxss          # 小程序入口
├── project.config.json       # 微信开发者工具配置
├── package.json              # npm scripts
│
├── pages/                    # 页面
│   ├── index/                # 首页（流水 / 待整理 / 结算 Tab）
│   ├── create/               # 创建账本
│   ├── flow/                 # 全部流水
│   ├── inbox/                # 待整理收件箱（AI 识别结果）
│   ├── settle/               # 结算中心
│   ├── member/               # 成员管理
│   └── detail/               # 账单详情
│
├── components/               # 公共组件
│   ├── fab-menu/             # 扇形弹出菜单
│   ├── amount-keyboard/      # 金额键盘
│   ├── add-bill-panel/       # 手动记账面板
│   ├── member-popup/         # 成员管理弹窗
│   └── bill-detail-popup/    # 账单详情弹窗
│
├── services/                 # 业务服务层
│   ├── book.service.js       # 账本 CRUD
│   ├── bill.service.js       # 账单 CRUD
│   ├── settle.service.js     # 结算算法（贪心+对冲）
│   ├── member.service.js     # 成员管理 + 影子认领
│   └── ai.service.js         # AI 拍照识别
│
├── utils/                    # 工具库
│   ├── calc.js               # 精确计算（避免浮点误差）
│   ├── currency.js           # 分/元转换、千分位格式化
│   ├── date.js               # 日期格式化
│   ├── id.js                 # ID 生成器
│   ├── cache.js              # 本地缓存封装
│   ├── store.js              # 全局状态管理
│   └── constants.js          # 常量（类目、币种、皮肤色）
│
├── styles/                   # 样式变量与动画
├── images/                   # 静态资源
│
├── tests/                    # 测试（174 用例）
│   ├── run.js                # 测试入口
│   ├── wx.mock.js            # 微信 API 模拟层
│   ├── test.helper.js        # describe/it/expect 框架
│   ├── calc.test.js          # 28 用例
│   ├── currency.test.js      # 42 用例
│   ├── date.test.js          # 20 用例
│   ├── id.test.js            # 9 用例
│   ├── cache.test.js         # 10 用例
│   ├── store.test.js         # 8 用例
│   ├── settle.test.js        # 11 用例
│   ├── book.test.js          # 10 用例
│   ├── bill.test.js          # 14 用例
│   ├── member.test.js        # 8 用例
│   └── integration.test.js   # 6 用例（完整用户流程）
│
├── scripts/
│   └── publish.js            # 一键发布脚本
│
└── docs/                     # 项目文档
    ├── PRD.md                # 产品需求文档
    └── ARCHITECTURE.md       # 架构设计文档
```

## 🚀 本地调试

### 环境要求

- [Node.js](https://nodejs.org/) >= 14（运行测试用）
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 最新稳定版

### 第一步：克隆项目

```bash
git clone https://github.com/xiaopengs/TripSplit.git
cd TripSplit
```

### 第二步：用微信开发者工具打开

1. 打开**微信开发者工具**
2. 选择「导入项目」或使用「+」号
3. **项目目录** 选择本项目的根文件夹（包含 `app.json` 的那个目录）
4. **AppID** 填入 `wx86331a99c51be758`（或你自己的小程序 AppID）

> 💡 如果你没有小程序 AppID，可以在微信开发者工具中选择「测试号」进行调试

### 第三步：编译预览

在微信开发者工具中点击**编译**按钮即可在模拟器中预览。

开发者工具左侧为模拟器，右侧为编辑器，支持实时热重载。

### 第四步：真机调试

1. 点击工具栏的 **预览** 按钮，生成二维码
2. 用微信扫描二维码，即可在手机上体验
3. 开启 **调试模式** 可以在手机上看到 console 日志

### 第五步：开发者工具常用设置

为了更好的调试体验，建议在微信开发者工具中调整以下设置：

| 设置项 | 路径 | 建议值 |
|--------|------|--------|
| ES6 转 ES5 | 详情 → 本地设置 | ✅ 开启 |
| 增强编译 | 详情 → 本地设置 | ✅ 开启 |
| 域名合法性校验 | 详情 → 本地设置 | ❌ 关闭（方便调用外部 API） |
| 压缩代码 | 详情 → 本地设置 | ❌ 关闭（调试时保持可读） |
| 不校验合法域名 | 详情 → 本地设置 | ✅ 开启 |

### 调试技巧

**1. 查看日志**

- 模拟器：开发者工具底部 **Console** 面板
- 真机：开启调试模式后，电脑端 vConsole 面板自动显示
- 关键日志均以 `[TripSplit]` 前缀标记

**2. 调试存储数据**

- 开发者工具顶部菜单 → **存储** → 可查看和编辑 `wx.setStorageSync` 的数据
- 或在 Console 中执行 `wx.getStorageInfoSync()` 查看所有缓存

**3. AppData 实时查看**

- 开发者工具顶部 **AppData** 面板可以实时查看页面数据（`this.data`）
- 支持直接修改数据来测试 UI 响应

**4. 网络请求调试**

- 开发者工具 **Network** 面板可以查看所有 `wx.request` 请求
- 可以设置代理来调试 API 接口

## 🧪 运行测试

本项目使用自研轻量测试框架，**零第三方依赖**，直接在 Node.js 环境运行：

```bash
# 运行所有测试（174 用例）
npm test

# 仅运行单元测试
npm run test:unit

# 仅运行集成测试
npm run test:integration
```

或直接用 Node：

```bash
node tests/run.js              # 全部
node tests/run.js unit         # 单元
node tests/run.js integration  # 集成
```

测试原理：通过 `wx.mock.js` 模拟微信小程序全局 API（`wx.getStorageSync` 等），使业务代码可以在 Node.js 中直接运行。

## 📦 一键发布

```bash
# 测试 + 上传到微信后台
npm run upload

# 测试 + 生成预览二维码
npm run preview

# 仅运行测试
npm test
```

> ⚠️ 发布功能依赖微信开发者工具 CLI，需要先开启「服务端口」：
> 微信开发者工具 → 设置 → 安全设置 → **服务端口（开启）**

也可以手动发布：在微信开发者工具中点击「上传」按钮。

## 📋 开发进度

### P0 核心功能 ✅
- [x] 账本创建（基本字段 + 影子成员）
- [x] 首页流水列表
- [x] 手动记账面板
- [x] 扇形弹出菜单 FAB
- [x] 成员管理 CRUD
- [x] 账单详情弹窗
- [x] 智能结算算法

### P1 重要功能 🔧
- [x] AI 拍照识别流程（模拟）
- [x] 待整理收件箱
- [x] 多币种支持
- [x] 离线缓存策略
- [ ] 影子成员认领完整流程

### P2 增强功能 📅
- [ ] 语音转文字备注
- [ ] 请款卡片生成
- [ ] 账本归档 / 多账本切换
- [ ] 数据导出
- [ ] 深色模式

## 📄 License

MIT
