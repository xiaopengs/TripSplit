# 🧩 拼途记账 TripSplit

> 旅行场景下的多人协作记账工具，支持 AI 拍照识别与智能结算

## ✨ 核心功能

- **零门槛创建** — 3 秒建账本，定位自动选币种，预设影子成员
- **AI 拍照识别** — 拍小票即走，后台自动识别金额与类目
- **手动极速录入** — 半屏面板 + 大号键盘，支持简易运算
- **智能结算** — 最少转账次数算法，自动对冲，一键请款
- **影子成员系统** — 旅行前预设成员，后期扫码认领无缝迁移
- **多币种支持** — 支持 CNY/JPY/USD/KRW/THB/EUR/GBP/HKD
- **离线记账** — 无网络时本地存储，恢复后自动同步

## 🛠 技术栈

- **框架**：微信原生小程序（WXML + WXSS + JavaScript）
- **状态管理**：自研轻量 Store（发布订阅模式）
- **数据存储**：微信云开发 CloudBase（规划中）
- **AI 能力**：OCR 图像识别（API 对接中）

## 📁 项目结构

```
TripSplit/
├── app.js/json/wxss          # 小程序入口
├── pages/                    # 页面
│   ├── index/                # 首页（流水/待整理/结算 Tab）
│   ├── create/               # 创建账本
│   ├── flow/                 # 全部流水
│   ├── inbox/                # 待整理收件箱
│   ├── settle/               # 结算中心
│   ├── member/               # 成员管理
│   └── detail/               # 账单详情
├── components/               # 公共组件
│   ├── fab-menu/             # 扇形弹出菜单
│   ├── amount-keyboard/      # 金额键盘
│   ├── add-bill-panel/       # 手动记账面板
│   ├── member-popup/         # 成员管理弹窗
│   └── bill-detail-popup/    # 账单详情弹窗
├── services/                 # 业务服务层
├── utils/                    # 工具库
├── styles/                   # 样式变量与动画
├── images/                   # 静态资源
└── docs/                     # 项目文档
```

## 🚀 快速开始

1. 克隆项目
```bash
git clone https://github.com/xiaopengs/TripSplit.git
```

2. 使用微信开发者工具打开项目目录

3. 修改 `project.config.json` 中的 AppID 为自己的小程序 AppID

4. 在微信开发者工具中编译预览

## 📖 文档

- [产品需求文档 (PRD)](./docs/PRD.md)
- [架构设计文档](./docs/ARCHITECTURE.md)

## 📋 开发进度

### P0 核心功能 ✅
- [x] 账本创建（基本字段 + 影子成员）
- [x] 首页流水列表
- [x] 手动记账面板
- [x] 扇形弹出菜单 FAB
- [x] 成员管理 CRUD
- [x] 账单详情弹窗

### P1 重要功能 🔧
- [x] AI 拍照识别流程（模拟）
- [x] 结算算法实现
- [x] 待整理收件箱
- [ ] 影子成员认领完整流程
- [x] 多币种支持
- [x] 离线缓存策略

### P2 增强功能 📅
- [ ] 语音转文字备注
- [ ] 请款卡片生成
- [ ] 账本归档/多账本切换
- [ ] 数据导出
- [ ] 深色模式

## 📄 License

MIT
