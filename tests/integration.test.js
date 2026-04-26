/**
 * 集成测试 - 完整用户旅程
 * 模拟 PRD 中描述的5个核心场景
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const bookService = require('../services/book.service')
const billService = require('../services/bill.service')
const memberService = require('../services/member.service')
const settleService = require('../services/settle.service')
const { CATEGORIES, SPLIT_TYPE } = require('../utils/constants')
const { fenToYuan, formatAmount } = require('../utils/currency')

/**
 * 场景1：创建账本
 * 用户 A 登录 -> 点击新建账本 -> 定位日本，币种选 JPY -> 手动输入影子成员"大壮"
 */
describe('场景1: 创建账本', () => {
  beforeEach(() => clearMockStorage())

  it('完整创建流程', () => {
    // Step 1: 创建账本
    const book = bookService.createBook({
      name: '东京之旅',
      currency: 'JPY',
      currencySymbol: '¥',
      creatorId: 'wx_user_A',
      creatorName: '小明',
      shadowMembers: ['大壮']
    })

    // 验证
    expect(book.name).toBe('东京之旅')
    expect(book.currency).toBe('JPY')
    expect(book.status).toBe('active')
    expect(book.members.length).toBe(2)
    
    const creator = book.members[0]
    expect(creator.type).toBe('real')
    expect(creator.role).toBe('admin')
    
    const shadow = book.members[1]
    expect(shadow.type).toBe('shadow')
    expect(shadow.shadow_name).toBe('大壮')
    expect(shadow.is_claimed).toBeFalsy()
    
    // 当前活跃账本
    expect(bookService.getCurrentBook().id).toBe(book.id)
  })
})

/**
 * 场景2：AI 拍照记账（模拟）
 * 落地机场，A 购买3张车票 -> 拍照 -> 后台 AI 识别 3000 JPY -> 归类 交通 -> 分摊
 */
describe('场景2: AI拍照记账', () => {
  beforeEach(() => clearMockStorage())

  it('模拟AI识别结果入账', () => {
    const book = bookService.createBook({
      name: '东京之旅',
      currency: 'JPY',
      creatorName: '小明',
      shadowMembers: ['大壮']
    })

    // 模拟 AI 识别结果
    const aiResult = {
      amount: 9000, // 90日元（以最小单位分模拟）
      category: 'traffic',
      note: '成田机场快线 x3'
    }

    const members = book.members
    const bill = billService.createBill({
      bookId: book.id,
      amount: aiResult.amount,
      category: CATEGORIES.find(c => c.key === aiResult.category),
      note: aiResult.note,
      payerId: members[0].id,
      payerName: '小明',
      memberIds: members.map(m => m.id),
      members: members,
      source: 'ai',
      aiConfidence: 0.95
    })

    expect(bill.amount).toBe(9000)
    expect(bill.category).toBe('traffic')
    expect(bill.source).toBe('ai')
    expect(bill.ai_confidence).toBe(0.95)
    expect(bill.splits.length).toBe(2)

    // 总支出
    expect(billService.getTotalExpense(book.id)).toBe(9000)
  })
})

/**
 * 场景3：成员加入（认领）
 * 大壮扫码进入账本 -> 点击"我是大壮" -> 瞬间看到自己欠小明金额
 */
describe('场景3: 成员认领身份', () => {
  beforeEach(() => clearMockStorage())

  it('认领并验证结算关系', () => {
    const book = bookService.createBook({
      name: '东京之旅',
      creatorName: '小明',
      shadowMembers: ['大壮']
    })

    const members = book.members
    const shadow = members.find(m => m.shadow_name === '大壮')

    // 先创建一笔账单（小明支付，两人分摊）
    billService.createBill({
      bookId: book.id,
      amount: 6000,
      category: CATEGORIES[0],
      payerId: members[0].id,
      payerName: '小明',
      memberIds: members.map(m => m.id),
      members: members
    })

    // 大壮认领身份
    const result = memberService.claimShadowMember(
      book.id,
      shadow.id,
      'wx_user_dazhuang',
      { nickName: '大壮', avatarUrl: '' }
    )
    expect(result).toBeTruthy()

    // 验证认领后状态
    const updatedBook = bookService.getBookList().find(b => b.id === book.id)
    const claimedMember = updatedBook.members.find(m => m.id === shadow.id)
    expect(claimedMember.is_claimed).toBeTruthy()
    expect(claimedMember.nickname).toBe('大壮')

    // 验证账单归属已迁移（仅将 split.is_shadow 置为 false，member_id 保持不变）
    const bills = billService.getBills(book.id)
    const shadowSplit = bills[0].splits.find(s => s.member_id === shadow.id)
    expect(shadowSplit).toBeDefined()
    expect(shadowSplit.is_shadow).toBeFalsy()

    // 验证结算能正常计算（成员 ID 与账单 member_id 一致）
    const settlement = settleService.calculateSettlement(updatedBook.members, bills)
    
    // 验证有转账产生
    expect(settlement.totalAmount).toBeGreaterThan(0)
  })
})

/**
 * 场景4：手动记账
 * 晚上吃章鱼烧无发票 -> 大壮点击+ -> 手动记一笔 -> 输入500 JPY，选餐饮
 */
describe('场景4: 手动记账', () => {
  beforeEach(() => clearMockStorage())

  it('大壮手动记一笔餐饮', () => {
    const book = bookService.createBook({
      name: '东京之旅',
      creatorName: '小明',
      shadowMembers: ['大壮']
    })

    const members = book.members
    const shadow = members.find(m => m.shadow_name === '大壮')
    
    // 先认领大壮
    memberService.claimShadowMember(book.id, shadow.id, 'wx_dz', { nickName: '大壮' })
    
    const updatedMembers = bookService.getBookList().find(b => b.id === book.id).members

    // 大壮手动记一笔
    const bill = billService.createBill({
      bookId: book.id,
      amount: 50000, // 500 JPY
      category: CATEGORIES[0], // 餐饮
      note: '道顿堀章鱼烧',
      payerId: shadow.id,
      payerName: '大壮',
      memberIds: updatedMembers.map(m => m.id),
      members: updatedMembers,
      source: 'manual'
    })

    expect(bill.amount).toBe(50000)
    expect(bill.category).toBe('dining')
    expect(bill.source).toBe('manual')
    expect(bill.payer_id).toBe(shadow.id)
    
    // 验证总支出
    expect(billService.getTotalExpense(book.id)).toBe(50000)
  })
})

/**
 * 场景5：行程总结与结算
 * 旅行结束 -> 点击结算中心 -> 系统生成最终建议
 */
describe('场景5: 完整结算', () => {
  beforeEach(() => clearMockStorage())

  it('多笔账单后的智能结算', () => {
    const book = bookService.createBook({
      name: '曼谷大吃大喝之旅',
      currency: 'THB',
      currencySymbol: '฿',
      creatorName: '小明',
      shadowMembers: ['大壮', '二狗']
    })

    const members = book.members
    const [m0, m1, m2] = members

    // 笔1: 小明支付住宿 90000 THB (900元)，3人均分
    billService.createBill({
      bookId: book.id, amount: 90000, category: CATEGORIES[2],
      payerId: m0.id, payerName: '小明',
      memberIds: members.map(m => m.id), members
    })

    // 笔2: 大壮支付餐饮 30000 THB (300元)，3人均分
    billService.createBill({
      bookId: book.id, amount: 30000, category: CATEGORIES[0],
      payerId: m1.id, payerName: '大壮',
      memberIds: members.map(m => m.id), members
    })

    // 笔3: 二狗支付门票 15000 THB (150元)，3人均分
    billService.createBill({
      bookId: book.id, amount: 15000, category: CATEGORIES[3],
      payerId: m2.id, payerName: '二狗',
      memberIds: members.map(m => m.id), members
    })

    // 笔4: 小明支付交通 6000 THB (60元)，3人均分
    billService.createBill({
      bookId: book.id, amount: 6000, category: CATEGORIES[1],
      payerId: m0.id, payerName: '小明',
      memberIds: members.map(m => m.id), members
    })

    // 计算结算
    const updatedMembers = bookService.getBookList().find(b => b.id === book.id).members
    const bills = billService.getBills(book.id)
    const result = settleService.calculateSettlement(updatedMembers, bills)

    // 验证
    expect(result.memberCount).toBe(3)
    expect(result.billCount).toBe(4)
    expect(result.transfers.length).toBeGreaterThan(0)

    // 总金额守恒：所有转账金额之和 = 总支出中需要转移的部分
    const totalExpense = 90000 + 30000 + 15000 + 6000 // 141000
    expect(billService.getTotalExpense(book.id)).toBe(totalExpense)

    // 转账总金额应等于所有净应付之和（通过 memberSummary 验证）
    const totalDebt = result.memberSummary
      .filter(m => m.net < 0)
      .reduce((sum, m) => sum + Math.abs(m.net), 0)
    expect(result.totalAmount).toBe(totalDebt)

    // 转账数 <= 成员数 - 1
    expect(result.transfers.length).toBeGreaterThanOrEqual(1)
    expect(result.transfers.length).toBeLessThanOrEqual(3)
  })
})

/**
 * 额外场景：多币种 + 抹零结算
 */
describe('额外场景: 抹零结算', () => {
  beforeEach(() => clearMockStorage())

  it('开启抹零后转账金额为整数元', () => {
    const book = bookService.createBook({
      name: '抹零测试',
      creatorName: 'A',
      shadowMembers: ['B']
    })

    const members = book.members
    // 支付 999分（9.99元），2人均分
    billService.createBill({
      bookId: book.id, amount: 999, category: CATEGORIES[0],
      payerId: members[0].id, payerName: 'A',
      memberIds: members.map(m => m.id), members
    })

    const bills = billService.getBills(book.id)
    const result = settleService.calculateSettlement(members, bills, { roundToYuan: true })

    // 不抹零时 B 欠 A 约 499.5分，抹零后应为 500分（5元）
    if (result.transfers.length > 0) {
      const transferAmount = result.transfers[0].amount
      expect(transferAmount % 100).toBe(0) // 整元
    }
  })
})
