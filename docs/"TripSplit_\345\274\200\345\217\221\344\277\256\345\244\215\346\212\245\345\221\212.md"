## TripSplit 拼途记账 — 全量修复报告

**日期**: 2026-04-05  
**版本**: v1.1 修复版  
**项目路径**: F:\CreateAI\ClawBuddy\workMain\TripSplit

---

## 本次需求：UI 右侧截断修复 + 分享功能补齐（2026-04-05）

### 1) 项目整体分析（微信原生小程序）

- **分层结构**：页面（pages）负责交互与渲染；组件（components）沉淀可复用 UI；服务层（services）承载业务逻辑与本地数据读写；工具层（utils）提供缓存、计算、日期、ID 等基础能力；全局样式与变量在 [app.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/app.wxss)。
- **数据存储方式**：当前实现以本地缓存为主（[utils/cache.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/utils/cache.js)），账本/账单/成员等数据主要落在 `ts_books`、`ts_bills` 等键上；架构文档预留了云开发方向，但本仓库代码路径仍以本地为准。
- **关键页面**：
  - 首页/流水/结算/待整理聚合在 [index](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/index/index.js)。
  - 新建账本在 [create](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/create/create.wxml)。
  - 成员管理既有独立页 [member](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/member/member.wxml)，也有首页弹窗组件 [member-popup](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/member-popup/member-popup.wxml)。
- **本次问题关联模块**：
  - “成员管理界面右侧截断”：主要出现在 `flex` 布局下文本容器未允许收缩，导致右侧按钮/图标被挤出容器并被 `overflow: hidden` 裁剪。
  - “新建账本界面右侧截断”：同类问题，`input + 按钮` 的 `flex` 行在父容器 `overflow: hidden` 时更容易出现右侧裁切。
  - “分享功能待开发”：代码中存在占位 toast（“分享功能开发中”），需要补齐为可实际触发系统分享面板，并生成可回跳的分享路径。

### 2) 下一步修复方案（针对 3 个问题）

#### 2.1 成员管理弹窗（member-popup）右侧截断

- **根因假设**：邀请卡片为 `display:flex`，左侧文本容器默认 `min-width:auto`，在长文案/字体缩放/窄屏时无法收缩，导致右侧圆形分享按钮被挤出并被裁剪。
- **方案**：
  - 给左侧文案容器添加 `min-width: 0`，并对标题/描述做省略与行数限制，保证右侧按钮永远可见。
  - 对成员名称做单行省略，避免“姓名过长”把按钮挤出卡片。

#### 2.2 新建账本页（create）右侧截断

- **根因假设**：影子成员“输入框 + 添加按钮”同为 `flex` 子项，`input` 默认最小宽度导致按钮溢出；同时父容器 `.form-item` 设置了 `overflow: hidden`，溢出内容会被直接裁剪。
- **方案**：
  - 给 `input` 增加 `min-width: 0`，并确保按钮 `flex-shrink: 0`，行容器补齐 `width: 100%` 与 `align-items:center`，消除右侧溢出。

#### 2.3 分享功能补齐

- **目标**：从成员管理入口能调起微信系统分享面板，并携带 `bookId` 回跳到首页；首页收到参数后尝试切换到对应账本。
- **方案**：
  - 把“邀请卡片”入口改为 `<button open-type="share">`（组件内触发分享的正确方式）。
  - 在页面实现 `onShareAppMessage`，统一生成 `title/path`。
  - 首页 `onLoad(options)` 识别 `bookId`，尝试切换当前账本；若本地无该账本则提示“当前版本暂不支持跨设备加入/同步”（为后续云同步留接口）。

### 3) 按方案实施与结果（已完成）

#### 3.1 UI 修复结果

- **成员管理弹窗**：邀请卡片与成员名称在窄屏/长文案下不再挤出右侧，右侧圆形分享按钮可完整显示。
- **新建账本页**：影子成员“输入 + 添加”行不再出现右侧裁切，“+ 添加”按钮完整可见。

补充：针对截图中“成员管理弹窗整体向左、右侧被裁剪”的场景，已在 [member-popup.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/member-popup/member-popup.wxss) 将弹窗容器由 `left/right: 0` 改为 `left/right: 24rpx`，让弹窗在屏幕中间留出左右安全边距，避免视觉上贴边或被系统裁切。

补充：手动记账面板同类问题已在 [add-bill-panel.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/add-bill-panel/add-bill-panel.wxss) 修复：将 `.panel` 由 `left/right: 0` 调整为 `left/right: 24rpx` 并加上 `max-width: calc(100vw - 48rpx)`，同时为 `.cs-name` 增加省略与 `min-width: 0`，避免在“自定义分摊”行被输入框挤压导致溢出。

#### 3.2 分享功能结果

- 成员管理弹窗与成员管理页面的“邀请好友加入账本”已可直接触发系统分享面板。
- 分享消息会携带 `bookId` 回跳到首页；首页收到 `bookId` 会尝试切换当前账本。

#### 3.3 关键改动文件

- UI：  
  - [member-popup.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/member-popup/member-popup.wxss)（`min-width:0` + 文案省略/行数限制）  
  - [create.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/create/create.wxss)（影子成员行 `min-width:0` 等）  
  - [member.wxml](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/member/member.wxml) / [member.wxss](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/member/member.wxss)
- 分享：  
  - [member-popup.wxml](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/member-popup/member-popup.wxml) / [member-popup.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/components/member-popup/member-popup.js)  
  - [index.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/index/index.js) / [index.wxml](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/index/index.wxml)  
  - [index.json](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/index/index.json) / [member.json](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/member/member.json)（开启 `enableShareAppMessage`）  
  - [member.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/pages/member/member.js)  
  - [book.service.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/services/book.service.js)（新增 `setCurrentBook`，支持通过分享参数切换账本）
- 测试更新：  
  - [member.test.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/tests/member.test.js) / [integration.test.js](file:///f:/CreateAI/ClawBuddy/workMain/TripSplit/tests/integration.test.js)（与“认领不改 member_id，仅改 is_shadow”逻辑保持一致）

#### 3.4 验证方式

- 由于 PowerShell 执行策略限制，`npm test` 在本环境下无法直接运行；已使用 `node tests/run.js` 跑通全部测试：**174/174 通过**。

---

### Phase 1: 关键 Bug 修复

**1.1 统一存储系统**

`utils/store.js` 原先在 `setState()` 中调用 `wx.setStorageSync` 做持久化，与 `utils/cache.js` 形成双写冲突。修复后 Store 改为纯内存发布订阅模式，所有持久化统一由 `cache.js`（带 `ts_` 前缀）负责。同步移除了 `app.js` 中的 `store.restore()` 调用。

**1.2 triggerEvent 双重嵌套**

微信组件的 `triggerEvent(name, detail)` 会自动将第二参数包裹到 `e.detail` 中。原代码多处写成 `triggerEvent('xxx', { detail: data })`，导致父组件需用 `e.detail.detail` 才能取到数据。修复涉及以下文件：

- `amount-keyboard.js`: `{ detail: key }` → `{ key: key }`
- `add-bill-panel.js`: `{ detail: submitData }` → 直接传 `submitData`
- `fab-menu.js`: 统一为 `triggerEvent('select', { key })`

**1.3 FAB 事件读取**

`index.js` 的 `onFabSelect` 原读 `e.detail` 作为字符串，但实际传入的是对象 `{ key: 'manual' }`。修复为 `e.detail.key`。

**1.4 账单详情数据绑定**

`bill-detail-popup.wxml` 中全部 `{{bill.*}}` 引用改为 `{{_formattedBill.*}}`，与 JS 中 observer 写入的变量名对齐。

**1.5 记账面板提交按钮**

`add-bill-panel.wxml` 原本缺少提交按钮，用户输入金额后无法确认。新增 "记一笔" 提交按钮行，并与 `onSubmit` 方法绑定。

---

### Phase 2: 全套 UI 重写

用 Emoji 替代了所有缺失的 `images/` 目录图标资源，全面对照截图重写了以下文件的 WXML + WXSS：

| 模块 | 文件 | 改动要点 |
|------|------|----------|
| 首页 | `index.wxml` / `index.wxss` | 绿色渐变 Header、胶囊对齐、Tab 药丸切换、日期分组流水列表、空状态 |
| FAB 菜单 | `fab-menu.*` | 全屏暗色遮罩、Spring 弹性展开、主按钮旋转变红 |
| 数字键盘 | `amount-keyboard.*` | 3x4 网格、36px 大字、点击态反馈 |
| 记账面板 | `add-bill-panel.*` | 88vh 高度、类目绿光选中、成员头像勾选、提交按钮 |
| 账单详情 | `bill-detail-popup.*` | 64rpx 绿色大金额、黄色"影子"标签、Emoji 信息行 |
| 成员管理 | `member-popup.*` | 绿色虚线邀请卡、黄色影子说明、珊瑚色"认领"按钮 |

品牌色变量体系定义在 `app.wxss`，包括 `--color-primary: #34C759`、`--color-bg: #F2F2F7` 等。

---

### Phase 3: 业务逻辑修复

**3.1 calc.js 精度修复 + bill.service 空值保护**

`multiply()` 函数原本使用 `Math.round(a * b * 100) / 100`，当结果非整数时会返回小数（如 33.3），违背"分为单位整数运算"原则。修复为 `Math.round(amount * multiplier)`。空值判断从 `!amount`（会把 0 当 falsy）改为 `amount == null`。

`bill.service.js` 新增多处防护：`category` 为空时回退空字符串；`members` 为空时用 `(members || [])` 包裹；日期字段三层回退（paid_at → local_created → 当前时间）；`formatAmountDisplay` 增加 `Number()` 转换和 `isNaN` 检查。

**3.2 AI 确认入账流程补全**

原 `onConfirmInbox` 仅将 inbox 状态标记为 `confirmed`，但从未用 AI 识别结果创建账单。修复后完整流程为：获取 inbox item → 提取 `ai_result` → 调用 `billService.createBill()` 建账 → 标记 confirmed → 刷新列表。

同时在 `ai.service.js` 中新增 `getInboxItemById(id)` 方法供 index 页面查询。

**3.3 结算状态持久化**

`markTransferPaid()` 和 `forgiveTransfer()` 原为空操作（仅 return true），结算每次重算后状态丢失。修复后使用 `cache.js` 存储 `transfer_statuses` 映射表，并在 `calculateSettlement()` 末尾将已保存状态回填到计算结果。

**3.4 影子成员认领 ID 修复**

`migrateBillOwnership()` 原将账单中的 `payer_id` 和 `split.member_id` 替换为 `user_${userId}` 格式，但成员表中 `member.id` 保持不变，导致结算时 ID 不匹配。修复后不再变更账单中的 ID 引用，仅将 `split.is_shadow` 标志位置为 `false`，保持 ID 一致性。

**3.5 账单删除事件链补全**

验证阶段发现 `bill-detail-popup` 的 `ondelete` 事件未在 `index.wxml` 中绑定，也无处理函数。补全了 `bind:ondelete="onDeleteBill"` 绑定及 `onDeleteBill` 方法（调用 `billService.deleteBill`、关闭弹窗、刷新列表）。

---

### 修改文件清单

| # | 文件 | Phase | 改动类型 |
|---|------|-------|----------|
| 1 | `utils/store.js` | 1.1 | 移除持久化 |
| 2 | `app.js` | 1.1 | 移除 restore |
| 3 | `components/amount-keyboard/amount-keyboard.js` | 1.2 | 修复 triggerEvent |
| 4 | `components/add-bill-panel/add-bill-panel.js` | 1.2 / 1.5 | 修复 triggerEvent + 输入 |
| 5 | `components/add-bill-panel/add-bill-panel.wxml` | 1.5 / 2 | 提交按钮 + UI 重写 |
| 6 | `components/add-bill-panel/add-bill-panel.wxss` | 2 | UI 重写 |
| 7 | `pages/index/index.js` | 1.3 / 3.2 / 3.5 | FAB 事件 + AI 入账 + 删除 |
| 8 | `pages/index/index.wxml` | 1.4 / 2 / 3.5 | UI 重写 + 删除绑定 |
| 9 | `pages/index/index.wxss` | 2 | UI 重写 |
| 10 | `components/fab-menu/fab-menu.wxml` | 2 | UI 重写 |
| 11 | `components/fab-menu/fab-menu.wxss` | 2 | UI 重写 |
| 12 | `components/fab-menu/fab-menu.js` | 2 | 事件重构 |
| 13 | `components/amount-keyboard/amount-keyboard.wxml` | 2 | UI 重写 |
| 14 | `components/amount-keyboard/amount-keyboard.wxss` | 2 | UI 重写 |
| 15 | `components/bill-detail-popup/bill-detail-popup.wxml` | 1.4 / 2 | 数据绑定修复 + UI |
| 16 | `components/bill-detail-popup/bill-detail-popup.wxss` | 2 | UI 重写 |
| 17 | `components/member-popup/member-popup.wxml` | 2 | UI 重写 |
| 18 | `components/member-popup/member-popup.wxss` | 2 | UI 重写 |
| 19 | `utils/calc.js` | 3.1 | multiply 精度修复 |
| 20 | `services/bill.service.js` | 3.1 | 空值保护 |
| 21 | `services/ai.service.js` | 3.2 | 新增 getInboxItemById |
| 22 | `services/settle.service.js` | 3.3 | 结算状态持久化 |
| 23 | `services/member.service.js` | 3.4 | 认领 ID 修复 |

共计 23 个文件变更，覆盖 3 大 Phase、12 个子任务。

---

### 验证结论

最终全量交叉验证结果：

- 5 条核心事件链（FAB → 首页、键盘 → 面板、面板 → 首页、详情弹窗 → 首页、成员弹窗 → 首页）全部连通
- 0 处 `triggerEvent({ detail: })` 双重嵌套残留
- 0 处 `e.detail.detail` 读取残留
- 0 处缺失图片资源引用（全部替换为 Emoji）
- 0 处 `store.restore()` 调用残留

项目可在微信开发者工具中打开进行功能测试。
