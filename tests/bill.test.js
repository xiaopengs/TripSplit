/**
 * 账单服务 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const bookService = require('../services/book.service')
const billService = require('../services/bill.service')
const { CATEGORIES, SPLIT_TYPE } = require('../utils/constants')

function setupBook(members = []) {
  return bookService.createBook({
    name: '测试账本',
    creatorName: '测试用户',
    shadowMembers: members
  })
}

describe('bill.createBill 创建账单', () => {
  beforeEach(() => clearMockStorage())

  it('手动创建一笔账单', () => {
    const book = setupBook(['大壮'])
    const members = book.members
    const bill = billService.createBill({
      bookId: book.id,
      amount: 10000, // 100元
      category: CATEGORIES[0], // 餐饮
      note: '午餐',
      payerId: members[0].id,
      payerName: '测试用户',
      memberIds: members.map(m => m.id),
      members: members,
      source: 'manual'
    })

    expect(bill).toBeDefined()
    expect(bill.amount).toBe(10000)
    expect(bill.category).toBe('dining')
    expect(bill.source).toBe('manual')
    expect(bill.splits.length).toBe(2) // 2人
    expect(bill.id).toBeTruthy()
  })

  it('自动均分正确', () => {
    const book = setupBook(['A', 'B'])
    const members = book.members
    const bill = billService.createBill({
      bookId: book.id,
      amount: 30000, // 300元, 3人
      category: CATEGORIES[1],
      payerId: members[0].id,
      payerName: '测试用户',
      memberIds: members.map(m => m.id),
      members: members
    })

    // 30000 / 3 = 10000 每人
    expect(bill.splits.length).toBe(3)
    bill.splits.forEach(s => expect(s.share).toBe(10000))
  })

  it('均分余数处理', () => {
    const book = setupBook(['B'])
    const members = book.members
    const bill = billService.createBill({
      bookId: book.id,
      amount: 1000, // 10元, 3人均分, 余1分
      category: CATEGORIES[2],
      payerId: members[0].id,
      payerName: '测试用户',
      memberIds: members.map(m => m.id),
      members: members
    })

    const total = bill.splits.reduce((sum, s) => sum + s.share, 0)
    expect(total).toBe(1000)
  })

  it('AI来源账单带置信度', () => {
    const book = setupBook([])
    const members = book.members
    const bill = billService.createBill({
      bookId: book.id,
      amount: 18000,
      category: CATEGORIES[3],
      payerId: members[0].id,
      payerName: '测试用户',
      memberIds: [members[0].id],
      members: members,
      source: 'ai',
      aiConfidence: 0.92
    })

    expect(bill.source).toBe('ai')
    expect(bill.ai_confidence).toBe(0.92)
  })

  it('自定义分摊', () => {
    const book = setupBook(['B'])
    const members = book.members
    const customSplits = [
      { member_id: members[0].id, name: '测试', share: 7000 },
      { member_id: members[1].id, name: 'B', share: 3000 }
    ]
    const bill = billService.createBill({
      bookId: book.id,
      amount: 10000,
      category: CATEGORIES[0],
      payerId: members[0].id,
      payerName: '测试用户',
      memberIds: members.map(m => m.id),
      members: members,
      splitType: SPLIT_TYPE.CUSTOM,
      customSplits: customSplits
    })

    expect(bill.split_type).toBe('custom')
    expect(bill.splits[0].share).toBe(7000)
    expect(bill.splits[1].share).toBe(3000)
  })
})

describe('bill.getBills 获取账单列表', () => {
  beforeEach(() => clearMockStorage())

  it('空账本返回空列表', () => {
    expect(billService.getBills('nonexistent')).toEqual([])
  })

  it('按时间降序排列', () => {
    const book = setupBook([])
    const members = book.members
    const makeBill = (i) => billService.createBill({
      bookId: book.id,
      amount: 1000 * (i + 1),
      category: CATEGORIES[0],
      payerId: members[0].id,
      payerName: '测试',
      memberIds: [members[0].id],
      members: members,
      paidAt: new Date(2026, 3, i + 1).toISOString() // 4月1日, 4月2日...
    })

    makeBill(0)
    makeBill(1)
    makeBill(2)

    const bills = billService.getBills(book.id)
    // 降序：4月3日 → 4月2日 → 4月1日
    expect(bills[0].amount).toBe(3000)
    expect(bills[1].amount).toBe(2000)
    expect(bills[2].amount).toBe(1000)
  })

  it('不同账本隔离', () => {
    const book1 = setupBook([])
    const book2 = setupBook([])
    
    billService.createBill({
      bookId: book1.id,
      amount: 1000,
      category: CATEGORIES[0],
      payerId: book1.members[0].id,
      payerName: '测试',
      memberIds: [book1.members[0].id],
      members: book1.members
    })

    billService.createBill({
      bookId: book2.id,
      amount: 2000,
      category: CATEGORIES[1],
      payerId: book2.members[0].id,
      payerName: '测试',
      memberIds: [book2.members[0].id],
      members: book2.members
    })

    expect(billService.getBills(book1.id).length).toBe(1)
    expect(billService.getBills(book2.id).length).toBe(1)
    expect(billService.getBills(book1.id)[0].amount).toBe(1000)
  })
})

describe('bill.getBillById', () => {
  beforeEach(() => clearMockStorage())

  it('获取存在的账单', () => {
    const book = setupBook([])
    const bill = billService.createBill({
      bookId: book.id,
      amount: 5000,
      category: CATEGORIES[0],
      payerId: book.members[0].id,
      payerName: '测试',
      memberIds: [book.members[0].id],
      members: book.members
    })

    const found = billService.getBillById(bill.id)
    expect(found).toBeDefined()
    expect(found.amount).toBe(5000)
  })

  it('不存在的ID返回null', () => {
    expect(billService.getBillById('nonexistent')).toBe(null)
  })
})

describe('bill.updateBill / deleteBill', () => {
  beforeEach(() => clearMockStorage())

  it('更新账单金额', () => {
    const book = setupBook([])
    const bill = billService.createBill({
      bookId: book.id,
      amount: 5000,
      category: CATEGORIES[0],
      payerId: book.members[0].id,
      payerName: '测试',
      memberIds: [book.members[0].id],
      members: book.members
    })

    const updated = billService.updateBill(bill.id, { amount: 8000, note: '已修改' })
    expect(updated.amount).toBe(8000)
    expect(updated.note).toBe('已修改')
  })

  it('删除账单', () => {
    const book = setupBook([])
    const bill = billService.createBill({
      bookId: book.id,
      amount: 5000,
      category: CATEGORIES[0],
      payerId: book.members[0].id,
      payerName: '测试',
      memberIds: [book.members[0].id],
      members: book.members
    })

    billService.deleteBill(bill.id)
    expect(billService.getBills(book.id).length).toBe(0)
  })
})

describe('bill.getTotalExpense / getBillsGroupedByDate', () => {
  beforeEach(() => clearMockStorage())

  it('计算总支出', () => {
    const book = setupBook([])
    billService.createBill({
      bookId: book.id, amount: 10000, category: CATEGORIES[0],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members
    })
    billService.createBill({
      bookId: book.id, amount: 25000, category: CATEGORIES[1],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members
    })

    expect(billService.getTotalExpense(book.id)).toBe(35000)
  })

  it('按日期分组', () => {
    const book = setupBook([])
    billService.createBill({
      bookId: book.id, amount: 10000, category: CATEGORIES[0],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members,
      paidAt: '2026-04-05T10:00:00'
    })
    billService.createBill({
      bookId: book.id, amount: 20000, category: CATEGORIES[1],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members,
      paidAt: '2026-04-05T12:00:00'
    })
    billService.createBill({
      bookId: book.id, amount: 15000, category: CATEGORIES[2],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members,
      paidAt: '2026-04-06T09:00:00'
    })

    const groups = billService.getBillsGroupedByDate(book.id)
    // 降序：4月6日 → 4月5日
    expect(groups.length).toBe(2)
    expect(groups[0].date).toBe('2026-04-06')
    expect(groups[0].total).toBe(15000)
    expect(groups[1].date).toBe('2026-04-05')
    expect(groups[1].total).toBe(30000)
    expect(groups[1].items.length).toBe(2)
  })
})

describe('bill 多人记账同步', () => {
  beforeEach(() => clearMockStorage())

  it('importCloudBills 导入云端账单到本地（被邀请者模式，无 ID 映射）', () => {
    const book = setupBook(['小明'])

    // 模拟云端账单（payer_id 是云端 member _id）
    const cloudBills = [{
      _id: 'cloud_bill_001',
      book_id: 'cloud_book_001',
      amount: 6000,
      category: 'food',
      category_name: '餐饮',
      note: '午餐',
      payer_id: 'cloud_mem_001',
      payer_name: '创建者',
      splits: [
        { member_id: 'cloud_mem_001', name: '创建者', share: 3000, is_shadow: false },
        { member_id: 'cloud_mem_002', name: '小明', share: 3000, is_shadow: false }
      ],
      split_type: 'equal',
      source: 'manual',
      paid_at: '2026-04-19T12:00:00',
      updated_at: Date.now()
    }]

    // B（被邀请者）模式：本地 book.id = cloud _id，无需映射
    const added = billService.importCloudBills(book.id, cloudBills, null)
    expect(added).toBe(1)

    const bills = billService.getBills(book.id)
    expect(bills.length).toBe(1)
    expect(bills[0].id).toBe('cloud_bill_001')
    expect(bills[0].payer_id).toBe('cloud_mem_001')
    expect(bills[0].payer_name).toBe('创建者')
    expect(bills[0].splits.length).toBe(2)
  })

  it('importCloudBills 带 ID 映射（创建者模式，cloud → local）', () => {
    const book = setupBook(['小明'])
    const localA = book.members[0].id // 创建者本地 ID
    const localB = book.members[1].id // 小明本地 ID

    // 云端账单使用云端 member ID
    const cloudBills = [{
      _id: 'cloud_bill_002',
      book_id: 'cloud_book_002',
      amount: 9000,
      category: 'transport',
      category_name: '交通',
      note: '打车',
      payer_id: 'cloud_mem_b',
      payer_name: '小明',
      splits: [
        { member_id: 'cloud_mem_a', name: '我', share: 4500, is_shadow: false },
        { member_id: 'cloud_mem_b', name: '小明', share: 4500, is_shadow: false }
      ],
      split_type: 'equal',
      source: 'manual',
      paid_at: '2026-04-19T14:00:00',
      updated_at: Date.now()
    }]

    // ID 映射：cloud → local
    const memberIdMap = {
      'cloud_mem_a': localA,
      'cloud_mem_b': localB
    }

    const added = billService.importCloudBills(book.id, cloudBills, memberIdMap)
    expect(added).toBe(1)

    const bills = billService.getBills(book.id)
    expect(bills[0].payer_id).toBe(localB) // 映射为本地 ID
    expect(bills[0].splits[0].member_id).toBe(localA)
    expect(bills[0].splits[1].member_id).toBe(localB)
  })

  it('importCloudBills 不重复导入已有账单', () => {
    const book = setupBook([])
    const cloudBills = [{
      _id: 'cloud_bill_003',
      book_id: 'cloud_book_003',
      amount: 3000,
      category: 'other',
      category_name: '其他',
      payer_id: 'mem_001',
      payer_name: 'test',
      splits: [],
      split_type: 'equal',
      source: 'cloud',
      paid_at: '2026-04-19T10:00:00',
      updated_at: Date.now()
    }]

    billService.importCloudBills(book.id, cloudBills, null)
    // 再次导入同样的账单
    const added = billService.importCloudBills(book.id, cloudBills, null)
    expect(added).toBe(0)
    expect(billService.getBills(book.id).length).toBe(1)
  })

  it('importCloudBills 通过 cloud_id 去重（A 本地 bill_xxx 已同步为 cloud_xxx）', () => {
    const book = setupBook([])
    // 模拟 A 本地创建了一笔账单（id=bill_local_001），并已同步获得 cloud_id
    const localBill = billService.createBill({
      bookId: book.id, amount: 5000, category: CATEGORIES[0],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members
    })
    // 模拟 _syncBillToCloud 成功后保存了 cloud_id
    billService.updateBill(localBill.id, { synced: true, cloud_id: 'cloud_dedup_001' })

    // syncData 返回同一笔账单（云端 _id 与 local 的 cloud_id 一致）
    const cloudBills = [{
      _id: 'cloud_dedup_001',
      book_id: book.id,
      amount: 5000,
      category: 'dining',
      category_name: '餐饮',
      payer_id: book.members[0].id,
      payer_name: '测试',
      splits: [{ member_id: book.members[0].id, name: '测试', share: 5000, is_shadow: false }],
      split_type: 'equal',
      source: 'manual',
      paid_at: localBill.paid_at,
      updated_at: Date.now()
    }]

    // 不应重复导入
    const added = billService.importCloudBills(book.id, cloudBills, null)
    expect(added).toBe(0)
    expect(billService.getBills(book.id).length).toBe(1)
  })

  it('deleteBillsByBook 删除指定账本所有账单', () => {
    const book1 = setupBook([])
    const book2 = setupBook([])

    billService.createBill({
      bookId: book1.id, amount: 1000, category: CATEGORIES[0],
      payerId: book1.members[0].id, payerName: 'A',
      memberIds: [book1.members[0].id], members: book1.members
    })
    billService.createBill({
      bookId: book2.id, amount: 2000, category: CATEGORIES[0],
      payerId: book2.members[0].id, payerName: 'B',
      memberIds: [book2.members[0].id], members: book2.members
    })

    billService.deleteBillsByBook(book1.id)
    expect(billService.getBills(book1.id).length).toBe(0)
    expect(billService.getBills(book2.id).length).toBe(1)
  })
})
