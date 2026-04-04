# 拼途记账（TripSplit）—— 项目架构设计文档

> **版本**：v1.0  
> **日期**：2026-04-05  
> **技术栈**：微信原生小程序（WXML + WXSS + JS + JSON）

---

## 1. 技术选型总览

| 维度 | 选型 | 说明 |
|------|------|------|
| 框架 | 微信原生小程序 | 不使用 Taro/uni-app，直接用官方原生 API |
| 语言 | JavaScript (ES6+) | 使用 async/await、解构、模板字符串等 |
| 样式 | WXSS + CSS 变量 | 品牌色系统化，支持主题切换预留 |
| 状态管理 | 自研轻量 Store | 基于 Observer 模式，全局 + 页面级 |
| AI 能力 | 微信云开发 / 外部 API | OCR 识别 + 图像理解 |
| 数据存储 | 微信云开发 CloudBase | 云数据库 + 云函数 + 云存储 |
| 构建工具 | 微信开发者工具 | 无需 webpack/vite |

---

## 2. 项目目录结构

```
TripSplit/
├── app.js                    # 小程序入口（全局数据、Store 初始化）
├── app.json                  # 小程序配置（页面路由、TabBar、权限）
├── app.wxss                  # 全局样式（变量、reset、通用组件）
├── project.config.json       # 项目配置（AppID、编译选项）
├── sitemap.json              # 小程序索引配置
│
├── docs/                     # 文档
│   ├── PRD.md                # 产品需求文档
│   └── ARCHITECTURE.md       # 本文档
│
├── pages/                    # 页面
│   ├── index/                # 首页（流水列表）
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   ├── index.js
│   │   └── index.json
│   ├── create/               # 创建账本页
│   ├── flow/                 # 流水详情页
│   ├── inbox/                # 待整理收件箱页
│   ├── settle/               # 结算中心页
│   ├── member/               # 成员管理页
│   └── detail/               # 账单详情弹窗页
│
├── components/               # 公共组件
│   ├── fab-menu/             # 扇形弹出菜单
│   ├── amount-keyboard/      # 金额输入键盘
│   ├── category-tile/        # 类目选择磁贴
│   ├── split-selector/       # 分摊成员选择器
│   ├── bill-card/            # 流水账单卡片
│   ├── inbox-card/           # 待整理 AI 卡片
│   ├── book-header/          # 顶部账本信息卡
│   ├── member-avatar/        # 成员头像组件
│   └── empty-state/          # 空状态占位组件
│
├── services/                 # 业务服务层
│   ├── book.service.js       # 账本 CRUD
│   ├── bill.service.js       # 账单 CRUD
│   ├── member.service.js     # 成员管理
│   ├── ai.service.js         # AI OCR 调用
│   ├── settle.service.js     # 结算算法
│   ├── exchange.service.js   # 汇率服务
│   └── sync.service.js       # 数据同步
│
├── utils/                    # 工具库
│   ├── store.js              # 全局状态管理
│   ├── request.js            # 网络请求封装（含幂等）
│   ├── currency.js           # 金额格式化（分→元）
│   ├── date.js               # 日期工具
│   ├── id.js                 # UUID 生成
│   ├── calc.js               # 精确计算工具（分单位整数运算）
│   ├── cache.js              # 本地缓存封装
│   ├── location.js           # 定位工具
│   └── constants.js          # 常量定义
│
├── styles/                   # 样式变量与 mixins
│   ├── variables.wxss        # CSS 变量（颜色、间距、字体）
│   ├── mixins.wxss           # 通用 mixin
│   └── animation.wxss        # 动画关键帧
│
└── images/                   # 静态图片资源
    ├── icons/                # 功能图标
    ├── skins/                # 账本皮肤背景图
    └── categories/           # 类目图标
```

---

## 3. 系统架构图

```
┌─────────────────────────────────────────────┐
│                  View 层                      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌───────┐ │
│  │首页  │ │创建  │ │流水  │ │结算  │ │待整理  │ │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └───┬───┘ │
│     └───────┴───────┴───────┴───────┘       │
│                    │                          │
│         ┌─────────▼─────────┐                │
│         │    Components 组件层  │                │
│         │ FAB / 键盘 / 类目 / 卡片 │              │
│         └─────────┬─────────┘                │
├───────────────────┼──────────────────────────┤
│           Service 层（业务逻辑）               │
│  ┌────────┬───────┴───────┬────────┐        │
│  │账本服务 │ 账单服务      │ 成员服务  │ AI服务 │
│  └────────┴───────┬───────┴────────┘        │
│                  │                           │
│  ┌───────────────┼───────────────┐          │
│  │ 结算算法       │ 汇率服务      │ 同步服务  │  │
│  └───────────────┼───────────────┘          │
├───────────────────┼──────────────────────────┤
│           Utils 层（基础能力）                │
│  ┌────────┬───────┴───────┬────────┐        │
│  │请求封装  │ 缓存管理      │ 精确计算  │ ID生成│  │
│  └────────┴───────────────┴────────┘        │
├─────────────────────────────────────────────┤
│              Infrastructure 层              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │云数据库    │  │云存储(OSS)│  │云函数     │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

---

## 4. 核心模块设计

### 4.1 全局状态管理（store.js）

采用发布订阅模式，轻量实现：

```javascript
// utils/store.js
class TripStore {
  constructor() {
    this._state = {
      // 当前活跃账本
      currentBook: null,
      
      // 当前账本的成员列表
      members: [],
      
      // 流水账单列表（按日期分组）
      bills: [],
      
      // 待整理 Inbox
      inbox: [],
      inboxUnread: 0,
      
      // 用户信息
      userInfo: null,
      
      // 网络状态
      online: true,
      
      // 离线队列
      offlineQueue: []
    }
    
    this._listeners = {}
  }
  
  // 获取状态
  getState(key) { return key ? this._state[key] : this._state }
  
  // 设置状态（触发监听器）
  setState(key, value) {
    this._state[key] = value
    this._emit(key, value)
    // 自动持久化到本地
    this._persist(key, value)
  }
  
  // 订阅变化
  subscribe(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = []
    this._listeners[key].push(callback)
    return () => this._unsubscribe(key, callback)
  }
  
  // ...
}

module.exports = new TripStore()
```

### 4.2 数据模型设计

#### 4.2.1 账本（Book）
```javascript
// 云数据库集合：books
{
  _id: "book_xxx",           // 自定义 ID
  name: "西藏之旅",           // 账本名称
  cover_color: "#34C759",    // 视觉皮肤颜色
  currency: "CNY",           // 默认币种
  currency_symbol: "¥",
  start_date: "2026-01-07",
  end_date: null,             // 归档时填写
  status: "active",           // active / archived
  
  creator_id: "user_openid",  // 创建者
  member_count: 4,
  
  created_at: timestamp,
  updated_at: timestamp
}
```

#### 4.2.2 成员（Member）
```javascript
// 云数据库集合：members（嵌套在 book 内或独立集合）
{
  _id: "mem_xxx",
  book_id: "book_xxx",
  
  // 身份类型
  type: "real",              // "real" | "shadow"
  
  // 真实用户信息
  user_id: "openid",         // type=real 时有值
  nickname: "我",
  avatar_url: "",
  
  // 影子成员信息
  shadow_name: "",           // type=shadow 时有值
  is_claimed: false,
  claimed_by: null,          // 认领后的 user_id
  claimed_at: null,
  
  role: "admin",             // admin / member
  joined_at: timestamp
}
```

#### 4.2.3 账单（Bill）
```javascript
// 云数据库集合：bills
{
  _id: "bill_xxx",
  book_id: "book_xxx",
  
  // 基本信息
  amount: 32850,             // 金额（分为单位！）
  amount_display: "328.50",
  category: "dining",        // dining/traffic/hotel/ticket/shopping/other
  category_name: "餐饮",
  note: "藏式火锅",           // 备注
  images: ["url1"],          // 图片 URL 列表
  
  // 支付人
  payer_id: "mem_xxx",       // 支付者 member ID
  payer_name: "我",
  
  // 分摊明细
  splits: [
    { member_id: "mem_1", name: "我", share: 8213 },
    { member_id: "mem_2", name: "小王", share: 8212, is_shadow: true },
    { member_id: "mem_3", name: "小李", share: 8213 },
    { member_id: "mem_4", name: "小张", share: 8212 }
  ],
  split_type: "equal",       // equal / custom
  
  // 来源
  source: "manual",          // manual / ai / ai_confirmed
  ai_confidence: null,       // AI 置信度（source=ai 时有值）
  
  // 时间
  paid_at: "2026-01-08T19:30:00",
  
  // 幂等标识
  request_id: "uuid",
  
  // 同步状态
  synced: true,
  local_created: timestamp,
  server_updated: timestamp
}
```

#### 4.2.4 待整理记录（Inbox Item）
```javascript
// 本地存储为主，确认后转为 bill
{
  _id: "inbox_xxx",
  book_id: "book_xxx",
  
  image_path: "wxfile://...",  // 本地临时路径
  image_url: "",               // 上传后的 OSS URL
  
  // AI 识别结果
  ai_result: {
    amount: 18000,             // 识别金额（分）
    confidence: 0.92,          // 置信度
    category: "traffic",
    note: "机场出租车"
  },
  
  // 用户修正（如有）
  correction: {
    amount: null,
    category: null,
    note: null
  },
  
  status: "pending",           // pending / confirmed / rejected
  created_at: timestamp
}
```

### 4.3 结算算法详细设计

```javascript
// services/settle.service.js

/**
 * 最少转账次数结算算法
 * 
 * @param {Array} members - 成员列表
 * @param {Array} bills - 账单列表
 * @returns {Array} 转账建议列表 [{from, to, amount}]
 */
function calculateSettlement(members, bills) {
  // Step 1: 计算每个成员的净收支（分）
  const balance = {}
  members.forEach(m => balance[m.id] = 0)
  
  bills.forEach(bill => {
    // 支付者增加应收款
    balance[bill.payer_id] += bill.amount
    
    // 分摊者增加应付款
    bill.splits.forEach(split => {
      balance[split.member_id] -= split.share
    })
  })
  
  // Step 2: 分离债权人和债务人（排除接近0的余额）
  const THRESHOLD = 50 // 5角以内忽略
  let debtors = []  // 应付款（balance < 0）
  let creditors = [] // 应收款（balance > 0）
  
  for (const [id, amount] of Object.entries(balance)) {
    if (amount < -THRESHOLD) {
      debtors.push({ id, amount: -amount })
    } else if (amount > THRESHOLD) {
      creditors.push({ id, amount })
    }
  }
  
  // Step 3: 降序排序
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)
  
  // Step 4: 贪心匹配
  const transfers = []
  let i = 0, j = 0
  
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    
    const transferAmount = Math.min(debtor.amount, creditor.amount)
    
    transfers.push({
      from: debtor.id,
      to: creditor.id,
      amount: transferAmount
    })
    
    debtor.amount -= transferAmount
    creditor.amount -= transferAmount
    
    if (debtor.amount <= THRESHOLD) i++
    if (creditor.amount <= THRESHOLD) j++
  }
  
  return transfers
}
```

### 4.4 AI 服务架构

```
[小程序端]                    [云端]
    │                            │
    │ 1. wx.chooseMedia()        │
    │ 2. wx.cloud.uploadFile()   │
    │ ──────────────────────────> │
    │                            │ 3. 接收文件 ID
    │                            │ 4. 调用 AI OCR API
    │                            │    （百度/腾讯/自建）
    │                            │ 5. 返回识别结果
    │ <────────────────────────── │
    │ 6. 写入本地 Inbox           │
    │ 7. 更新 UI 红点提示         │
    │                            │
```

AI OCR 返回数据格式：
```json
{
  "success": true,
  "data": {
    "amount": 18000,
    "confidence": 0.92,
    "category": "traffic",
    "category_name": "交通",
    "note": "机场出租车",
    "raw_text": "出租车费 180.00元"
  }
}
```

---

## 5. 组件设计规范

### 5.1 组件通信模式

```
页面 (Page)
  │
  ├─→ props (单向数据流)
  │   ↓
│   Component
  │   │
  │   ← triggerEvent (事件冒泡)
  │
  └─→ Store (全局状态)
      ↓
    跨页面共享
```

### 5.2 关键组件接口定义

#### fab-menu 扇形菜单
```json
{
  "component": true,
  "properties": {
    "visible": { "type": Boolean, "value": false },
    "buttons": {
      "type": Array,
      "value": [
        { "key": "manual", "icon": "edit", "label": "手动记一笔" },
        { "key": "camera", "icon": "camera", "label": "拍照记账" }
      ]
    }
  },
  "methods": {
    "show": "() => void",
    "hide": "() => void",
    "toggle": "() => void"
  },
  "events": {
    "onselect": "(key: string) => void"
  }
}
```

#### amount-keyboard 金额键盘
```json
{
  "component": true,
  "properties": {
    "value": { "type": String, "value": "0", "observer": "_onValueChange" },
    "max": { "type": Number, "value": 99999999 } // 分为单位
  },
  "events": {
    "oninput": "(value: string) => void",
    "onconfirm": "() => void",
    "oncancel": "() => void"
  }
}
```

#### split-selector 分摊选择器
```json
{
  "component": true,
  "properties": {
    "members": { "type": Array, "value": [] },
    "selectedIds": { "type": Array, "value": [], "observer": "_calcShares" },
    "totalAmount": { "type": Number, "value": 0 }, // 分
    "mode": { "type": String, "value": "equal" } // equal | custom
  },
  "events": {
    "onchange": "(splits: Array) => void"
  }
}
```

---

## 6. 样式系统设计

### 6.1 CSS 变量（variables.wxss）

```css
:root {
  /* === Brand Colors === */
  --color-primary: #34C759;
  --color-primary-light: #5ED47A;
  --color-primary-dark: #248A3D;
  --color-secondary: #FF9500;
  --color-accent: #5856D6;

  /* === Semantic Colors === */
  --color-success: #34C759;
  --color-warning: #FFCC00;
  --color-danger: #FF3B30;
  --color-info: #007AFF;
  
  /* == Text Colors === */
  --text-primary: #1C1C1E;
  --text-secondary: #8E8E93;
  --text-tertiary: #AEAEB2;
  --text-white: #FFFFFF;
  --text-on-primary: #FFFFFF;

  /* === Backgrounds === */
  --bg-primary: #F2F2F7;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-mask: rgba(0, 0, 0, 0.45);

  /* === Borders === */
  --border-color: #E5E5EA;
  --border-radius-sm: 8rpx;
  --border-radius-md: 16rpx;
  --border-radius-lg: 24rpx;
  --border-radius-xl: 32rpx;
  --border-radius-round: 50%;

  /* === Spacing === */
  --spacing-xs: 8rpx;
  --spacing-sm: 16rpx;
  --spacing-md: 24rpx;
  --spacing-lg: 32rpx;
  --spacing-xl: 48rpx;

  /* === Typography === */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 22rpx;
  --font-size-sm: 26rpx;
  --font-size-base: 28rpx;
  --font-size-md: 32rpx;
  --font-size-lg: 36rpx;
  --font-size-xl: 44rpx;
  --font-size-xxl: 56rpx;
  
  /* Amount Display */
  --font-amount: 48rpx;
  --font-amount-large: 64rpx;

  /* === Shadows === */
  --shadow-sm: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8rpx 32rpx rgba(0, 0, 0, 0.14);
  
  /* === Animation === */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --spring-curve: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

### 6.2 6 种账本皮肤颜色
```javascript
const SKIN_COLORS = [
  { name: '森林绿', value: '#34C759', light: '#5ED47A' },
  { name: '海洋蓝', value: '#007AFF', light: '#409CFF' },
  { name: '暖阳橙', value: '#FF9500', light: '#FFB340' },
  { name: '玫瑰红', value: '#FF2D55', light: '#FF607D' },
  { name: '紫罗兰', value: '#AF52DE', light: '#C87DE6' },
  { name: '薄荷青', value: '#5AC8FA', light: '#85DBFB' },
]
```

---

## 7. 数据流与同步策略

### 7.1 在线模式
```
用户操作 → 本地 UI 更新 → 写入本地 Storage → 发送到云端
                                        ↓
                              返回成功 ← 云数据库写入
                                        ↓
                              更新 sync_status = true
```

### 7.2 离线模式
```
用户操作 → 本地 UI 更新 → 写入本地 Storage
                                  ↓
                         加入 offlineQueue（数组）
                                  ↓
              wx.onNetworkStatusChange 监听网络恢复
                                  ↓
                         FIFO 逐条上传至云端
                                  ↓
                         上传成功后从队列移除
                                  ↓
                         更新本地 sync_status = true
```

### 7.3 冲突解决策略
- **Last Write Wins**：同一账单以最后更新的为准
- **基于时间戳**：`updated_at` 较新的覆盖旧的
- **账单级粒度**：冲突发生在单条账单级别，不影响其他数据

---

## 8. 安全设计

### 8.1 权限控制
| 操作 | 所需角色 |
|------|---------|
| 创建账本 | 任意登录用户 |
| 编辑账本信息 | 仅管理员 |
| 添加/移除成员 | 仅管理员 |
| 记账 | 所有成员 |
| 编辑自己的账单 | 支付者本人 |
| 编辑他人账单 | 仅管理员 |
| 结算操作 | 所有成员可查看 |
| 归档账本 | 仅管理员 |

### 8.2 云数据库安全规则
```javascript
// 云数据库权限规则示例
{
  "books": {
    "read": "auth.openId in doc.members[*].user_id || doc.creator_id == auth.openId",
    "write": "doc.creator_id == auth.openId"
  },
  "bills": {
    "read": "get(database.collection('books').doc(doc.book_id)).members[*].user_id contains auth.openId",
    "write": "doc.payer_id == auth.openId || get(database.collection('books').doc(doc.book_id)).creator_id == auth.openId"
  }
}
```

### 8.3 数据加密
- 敏感字段（如 openid）不在客户端明文展示
- 分享链接使用一次性 token，有效期 7 天
- 云函数间调用通过内部安全认证

---

## 9. 性能优化策略

### 9.1 首屏优化
- 账本列表使用本地缓存优先策略
- 流水列表按需加载（首次加载 20 条，滚动到底部再加载 20 条）
- 图片懒加载 + 缩略图预览

### 9.2 渲染优化
- 长列表使用虚拟滚动（recycle-view 或自定义实现）
- 减少 setData 数据量（只传变化的数据字段）
- WXS 过滤器处理纯展示逻辑

### 9.3 网络优化
- 请求合并：批量提交离线队列
- 数据增量同步：基于 `updated_at` 时间戳做 diff
- 图片压缩：上传前压缩至 1080p 以下

---

## 10. 开发阶段规划

### Phase 1：基础框架（当前）
- [x] 项目初始化与 Git 仓库
- [ ] app.js/json/wxss 基础框架
- [ ] 工具库搭建（request/store/currency/calc/id/cache）
- [ ] 样式变量系统

### Phase 2：核心功能
- [ ] 创建账本页面 + 表单校验
- [ ] 首页流水列表（空状态 + 有数据）
- [ ] FAB 扇形弹出菜单组件
- [ ] 手动记账面板（键盘+类目+分摊）
- [ ] 成员管理弹窗
- [ ] 账单详情弹窗

### Phase 3：AI 与结算
- [ ] 相机拍照流程
- [ ] AI 服务对接
- [ ] 待整理 Inbox
- [ ] 结算算法实现
- [ ] 结算方案 UI

### Phase 4：增强体验
- [ ] 影子成员认领完整流程
- [ ] 多币种汇率
- [ ] 离线缓存与同步
- [ ] 动画细节打磨
- [ ] 异常处理完善
