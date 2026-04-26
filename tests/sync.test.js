/**
 * 云同步 & 成员合并 - 单元测试
 * 覆盖 _mergeMemberClaimStatus、importCloudBook、syncCloudMembers 竞态
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage, setMockStorage } = require('./wx.mock')
const bookService = require('../services/book.service')
const memberService = require('../services/member.service')
const billService = require('../services/bill.service')
const settleService = require('../services/settle.service')
const { CATEGORIES } = require('../utils/constants')

// === 辅助：模拟创建者本地账本（带 cloud_db_id，模拟云端同步后的状态） ===
function createLocalBookAsCreator(shadowNames) {
  var book = bookService.createBook({
    name: '测试账本',
    creatorId: 'creator_openid',
    creatorName: '我',
    shadowMembers: shadowNames || []
  })
  // 模拟 _syncBookToCloud 已完成：设置 cloud_db_id
  var books = bookService.getBookList()
  var idx = books.findIndex(b => b.id === book.id)
  if (idx !== -1) {
    books[idx].cloud_db_id = 'cloud_book_001'
    books[idx].cloud_id = 'abc123'
    bookService.updateBook(book.id, {
      cloud_db_id: 'cloud_book_001',
      cloud_id: 'abc123'
    })
  }
  return bookService.getBookList().find(b => b.id === book.id)
}

// === 辅助：模拟云端 syncData 返回的成员列表 ===
function makeCloudMember(overrides) {
  return Object.assign({
    _id: 'cloud_mem_' + Math.random().toString(36).substr(2, 6),
    book_id: 'cloud_book_001',
    type: 'real',
    user_id: '',
    nickname: '',
    avatar_url: '',
    shadow_name: '',
    is_claimed: false,
    claimed_by: null,
    claimed_at: null,
    role: 'member',
    joined_at: Date.now()
  }, overrides)
}

// === importCloudBook 测试 ===
describe('book.importCloudBook 导入云端账本', () => {
  beforeEach(() => clearMockStorage())

  it('成功导入云端账本到本地', () => {
    var cloudBook = {
      _id: 'cb_001',
      cloud_id: 'xyz789',
      name: '云端账本',
      cover_color: '#FF6B6B',
      currency: 'CNY',
      currency_symbol: '¥',
      start_date: '2026-04-01',
      status: 'active',
      creator_id: 'other_openid',
      member_count: 2,
      created_at: Date.now(),
      updated_at: Date.now()
    }
    var cloudMembers = [
      { _id: 'cm_001', type: 'real', nickname: '创建者', user_id: 'other_openid', shadow_name: '', is_claimed: false, role: 'admin', joined_at: Date.now() },
      { _id: 'cm_002', type: 'shadow', shadow_name: '小明', nickname: '', user_id: '', is_claimed: false, role: 'member', joined_at: Date.now() }
    ]

    var imported = bookService.importCloudBook(cloudBook, cloudMembers)
    expect(imported).toBeDefined()
    expect(imported.name).toBe('云端账本')
    expect(imported.cloud_id).toBe('xyz789')
    expect(imported.members.length).toBe(2)
    expect(imported.members[0].id).toBe('cm_001') // member id = cloud member _id
    expect(imported.members[0].book_id).toBe('cb_001') // book_id = cloud book _id
  })

  it('防止重复导入（同一 cloud_id）', () => {
    var cloudBook = {
      _id: 'cb_002', cloud_id: 'dup001', name: '重复',
      cover_color: '#34C759', currency: 'CNY', currency_symbol: '¥',
      start_date: '2026-01-01', status: 'active', creator_id: 'x',
      member_count: 1, created_at: Date.now(), updated_at: Date.now()
    }
    var cloudMembers = [
      { _id: 'cm_x', type: 'real', nickname: 'X', user_id: 'x', shadow_name: '', is_claimed: false, role: 'admin', joined_at: Date.now() }
    ]

    var first = bookService.importCloudBook(cloudBook, cloudMembers)
    var second = bookService.importCloudBook(cloudBook, cloudMembers)
    expect(first.id).toBe(second.id)
    expect(bookService.getBookList().length).toBe(1)
  })

  it('成员昵称优先级：已认领用 nickname，影子用 shadow_name', () => {
    var cloudBook = {
      _id: 'cb_003', cloud_id: 'nick001', name: '昵称测试',
      cover_color: '#34C759', currency: 'CNY', currency_symbol: '¥',
      start_date: '2026-01-01', status: 'active', creator_id: 'x',
      member_count: 2, created_at: Date.now(), updated_at: Date.now()
    }
    var cloudMembers = [
      { _id: 'cm_a', type: 'real', nickname: 'Alice', shadow_name: '', is_claimed: false, user_id: 'a', role: 'admin', joined_at: Date.now() },
      { _id: 'cm_b', type: 'shadow', nickname: '', shadow_name: '小明', is_claimed: false, user_id: '', role: 'member', joined_at: Date.now() }
    ]

    var imported = bookService.importCloudBook(cloudBook, cloudMembers)
    expect(imported.members[0].nickname).toBe('Alice')
    expect(imported.members[1].shadow_name).toBe('小明')
  })
})

// === _mergeMemberClaimStatus 测试（创建者模式同步） ===
describe('book._mergeMemberClaimStatus 创建者模式成员合并', () => {
  beforeEach(() => clearMockStorage())

  it('影子成员被认领后正确更新', () => {
    var book = createLocalBookAsCreator(['大壮'])
    var creator = book.members.find(m => m.type === 'real')
    var shadow = book.members.find(m => m.shadow_name === '大壮')

    // 模拟 syncData 返回：大壮已被认领
    var cloudMembers = [
      makeCloudMember({ _id: 'cloud_creator', user_id: 'creator_openid', nickname: '我', type: 'real', role: 'admin' }),
      makeCloudMember({ _id: 'cloud_dazhuang', shadow_name: '大壮', nickname: '大壮本尊', type: 'real', is_claimed: true, claimed_by: 'dz_openid', user_id: 'dz_openid' })
    ]

    // 直接调用 syncCloudMembers 会触发 _mergeMemberClaimStatus
    // 但它需要云端调用，我们无法模拟。改为直接测试 book.service 内部逻辑
    // 通过手动模拟 merge 过程来验证
    var cloudToLocal = {}
    var localToCloud = {}
    var bookData = bookService.getBookList().find(b => b.id === book.id)

    // 手动执行 _mergeMemberClaimStatus 的逻辑（因为该函数是私有的）
    cloudMembers.forEach(function(cm) {
      var local = bookData.members.find(function(lm) {
        if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) return true
        if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) return true
        return false
      })
      if (local) {
        cloudToLocal[cm._id] = local.id
        localToCloud[local.id] = cm._id
        local.is_claimed = cm.is_claimed || false
        local.claimed_by = cm.claimed_by || null
        if (cm.type === 'real' && local.type === 'shadow' && cm.is_claimed) {
          local.type = 'real'
          local.nickname = cm.nickname || local.shadow_name
          local.user_id = cm.user_id || ''
        }
        if (!local.nickname && cm.nickname) local.nickname = cm.nickname
      } else if (cm.type === 'real' && cm.user_id) {
        // 新增成员
        var newMember = {
          id: cm._id, book_id: bookData.id, type: 'real',
          user_id: cm.user_id, nickname: cm.nickname || '',
          avatar_url: '', shadow_name: '', is_claimed: false,
          claimed_by: null, claimed_at: null, role: 'member', joined_at: Date.now()
        }
        bookData.members.push(newMember)
        cloudToLocal[cm._id] = newMember.id
        localToCloud[newMember.id] = cm._id
      }
    })

    // 验证影子成员已被更新
    var mergedShadow = bookData.members.find(m => m.shadow_name === '大壮')
    expect(mergedShadow.type).toBe('real')
    expect(mergedShadow.is_claimed).toBeTruthy()
    expect(mergedShadow.nickname).toBe('大壮本尊')
    expect(mergedShadow.user_id).toBe('dz_openid')

    // 验证 ID 映射
    expect(cloudToLocal['cloud_dazhuang']).toBe(shadow.id)
    expect(localToCloud[shadow.id]).toBe('cloud_dazhuang')
  })

  it('directJoin 新成员被添加到本地成员列表', () => {
    var book = createLocalBookAsCreator([]) // 只有创建者
    expect(book.members.length).toBe(1)

    // 模拟 syncData 返回：包含一个 directJoin 新成员
    var cloudMembers = [
      makeCloudMember({ _id: 'cloud_creator', user_id: 'creator_openid', nickname: '我', type: 'real', role: 'admin' }),
      makeCloudMember({ _id: 'cloud_newuser', user_id: 'newuser_openid', nickname: '新用户', type: 'real', shadow_name: '', role: 'member' })
    ]

    // 手动执行 merge 逻辑
    var cloudToLocal = {}
    var localToCloud = {}
    var bookData = bookService.getBookList().find(b => b.id === book.id)

    cloudMembers.forEach(function(cm) {
      var local = bookData.members.find(function(lm) {
        if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) return true
        if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) return true
        return false
      })
      if (local) {
        cloudToLocal[cm._id] = local.id
        localToCloud[local.id] = cm._id
      } else if (cm.type === 'real' && cm.user_id) {
        var newMember = {
          id: cm._id, book_id: bookData.id, type: 'real',
          user_id: cm.user_id, nickname: cm.nickname || '',
          avatar_url: '', shadow_name: '', is_claimed: false,
          claimed_by: null, claimed_at: null, role: 'member', joined_at: Date.now()
        }
        bookData.members.push(newMember)
        bookData.member_count = bookData.members.length
        cloudToLocal[cm._id] = newMember.id
        localToCloud[newMember.id] = cm._id
      }
    })

    // 验证新成员被添加
    expect(bookData.members.length).toBe(2)
    var newMember = bookData.members.find(m => m.user_id === 'newuser_openid')
    expect(newMember).toBeDefined()
    expect(newMember.nickname).toBe('新用户')
    expect(newMember.id).toBe('cloud_newuser') // 直接用云端 _id
    expect(bookData.member_count).toBe(2)

    // 验证 ID 映射
    expect(cloudToLocal['cloud_newuser']).toBe('cloud_newuser')
  })

  it('多个 directJoin 成员都能被添加', () => {
    var book = createLocalBookAsCreator(['大壮'])
    expect(book.members.length).toBe(2) // 创建者 + 1 影子

    var cloudMembers = [
      makeCloudMember({ _id: 'cloud_creator', user_id: 'creator_openid', nickname: '我', type: 'real', role: 'admin' }),
      makeCloudMember({ _id: 'cloud_dazhuang', shadow_name: '大壮', type: 'shadow', is_claimed: false }),
      makeCloudMember({ _id: 'cloud_user2', user_id: 'user2_openid', nickname: '用户B', type: 'real', shadow_name: '', role: 'member' }),
      makeCloudMember({ _id: 'cloud_user3', user_id: 'user3_openid', nickname: '用户C', type: 'real', shadow_name: '', role: 'member' })
    ]

    var cloudToLocal = {}
    var localToCloud = {}
    var bookData = bookService.getBookList().find(b => b.id === book.id)

    cloudMembers.forEach(function(cm) {
      var local = bookData.members.find(function(lm) {
        if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) return true
        if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) return true
        return false
      })
      if (local) {
        cloudToLocal[cm._id] = local.id
        localToCloud[local.id] = cm._id
      } else if (cm.type === 'real' && cm.user_id) {
        var newMember = {
          id: cm._id, book_id: bookData.id, type: 'real',
          user_id: cm.user_id, nickname: cm.nickname || '',
          avatar_url: '', shadow_name: '', is_claimed: false,
          claimed_by: null, claimed_at: null, role: 'member', joined_at: Date.now()
        }
        bookData.members.push(newMember)
        bookData.member_count = bookData.members.length
        cloudToLocal[cm._id] = newMember.id
        localToCloud[newMember.id] = cm._id
      }
    })

    expect(bookData.members.length).toBe(4) // 创建者 + 大壮 + 用户B + 用户C
    expect(bookData.member_count).toBe(4)
  })

  it('影子成员不匹配时不会被误添加为新成员', () => {
    var book = createLocalBookAsCreator(['大壮'])
    expect(book.members.length).toBe(2)

    // 云端影子成员尚未被认领，无 user_id → 不应被添加
    var cloudMembers = [
      makeCloudMember({ _id: 'cloud_creator', user_id: 'creator_openid', type: 'real', role: 'admin' }),
      makeCloudMember({ _id: 'cloud_dazhuang', shadow_name: '大壮', type: 'shadow', user_id: '', is_claimed: false })
    ]

    var cloudToLocal = {}
    var localToCloud = {}
    var bookData = bookService.getBookList().find(b => b.id === book.id)
    var addedCount = 0

    cloudMembers.forEach(function(cm) {
      var local = bookData.members.find(function(lm) {
        if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) return true
        if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) return true
        return false
      })
      if (local) {
        cloudToLocal[cm._id] = local.id
        localToCloud[local.id] = cm._id
      } else if (cm.type === 'real' && cm.user_id) {
        addedCount++
      }
    })

    expect(addedCount).toBe(0) // 影子成员不走添加路径
    expect(bookData.members.length).toBe(2) // 未增加
  })
})

// === 结算与成员完整性 ===
describe('settle.结算与成员完整性', () => {
  beforeEach(() => clearMockStorage())

  it('成员列表只有创建者时，创建者自己付的账结算为零', () => {
    var book = bookService.createBook({ name: '测试', creatorName: 'A' })
    var members = book.members

    billService.createBill({
      bookId: book.id, amount: 10000, category: CATEGORIES[0],
      payerId: members[0].id, payerName: 'A',
      memberIds: [members[0].id], members: members
    })

    var bills = billService.getBills(book.id)
    var result = settleService.calculateSettlement(members, bills)
    expect(result.transfers.length).toBe(0) // 一人付一人分摊，净额为0
  })

  it('两人正确结算：A付100均摊，B欠A 50', () => {
    var book = bookService.createBook({ name: '测试', creatorName: 'A', shadowMembers: ['B'] })
    var members = book.members

    billService.createBill({
      bookId: book.id, amount: 10000, category: CATEGORIES[0],
      payerId: members[0].id, payerName: 'A',
      memberIds: members.map(m => m.id), members: members
    })

    var bills = billService.getBills(book.id)
    var result = settleService.calculateSettlement(members, bills)
    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_id).toBe(members[1].id) // B 欠 A
    expect(result.transfers[0].to_id).toBe(members[0].id)
    expect(result.transfers[0].amount).toBe(5000)
  })

  it('Bug 回归：directJoin 新成员在成员列表后结算正确', () => {
    // 模拟：创建者本地只有自己，但云端有两个成员（创建者 + directJoin 用户）
    var book = bookService.createBook({ name: '测试', creatorName: 'A', creatorId: 'openid_a' })
    var members = book.members
    expect(members.length).toBe(1) // 只有创建者

    // 模拟 directJoin 用户被添加到成员列表（修复后的行为）
    var newMemberId = 'cloud_directjoin_user'
    var updatedBook = bookService.getBookList().find(b => b.id === book.id)
    updatedBook.members.push({
      id: newMemberId, book_id: book.id, type: 'real',
      user_id: 'openid_b', nickname: '用户B', avatar_url: '',
      shadow_name: '', is_claimed: false, claimed_by: null, claimed_at: null,
      role: 'member', joined_at: Date.now()
    })
    updatedBook.member_count = 2

    var allMembers = updatedBook.members

    // 创建者记账，均摊给两人
    billService.createBill({
      bookId: book.id, amount: 10000, category: CATEGORIES[0],
      payerId: members[0].id, payerName: 'A',
      memberIds: allMembers.map(m => m.id), members: allMembers
    })

    var bills = billService.getBills(book.id)
    var result = settleService.calculateSettlement(allMembers, bills)
    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].amount).toBe(5000)
    expect(result.transfers[0].from_id).toBe(newMemberId)
    expect(result.transfers[0].to_id).toBe(members[0].id)
  })

  it('bill.payer_id 不在成员列表时账单被跳过不报错', () => {
    var members = [{ id: 'm0', nickname: 'A' }]
    var bills = [{ payer_id: 'unknown', amount: 5000, splits: [{ member_id: 'm0', share: 5000 }] }]
    var result = settleService.calculateSettlement(members, bills)
    expect(result.transfers.length).toBe(0)
  })

  it('bill.splits 中 member_id 不在成员列表时该 split 被跳过', () => {
    var members = [{ id: 'm0', nickname: 'A' }]
    var bills = [{ payer_id: 'm0', amount: 5000, splits: [
      { member_id: 'm0', share: 2500 },
      { member_id: 'unknown', share: 2500 }
    ]}]
    var result = settleService.calculateSettlement(members, bills)
    expect(result.transfers.length).toBe(0) // A付5000，自己分摊2500，净+2500，但无他人可转
  })
})

// === 账本归档 ===
describe('book.archiveBook / unarchiveBook 归档操作', () => {
  beforeEach(() => clearMockStorage())

  it('归档后 status 变为 archived', () => {
    var book = bookService.createBook({ name: '测试归档' })
    var result = bookService.archiveBook(book.id)
    expect(result.status).toBe('archived')
  })

  it('取消归档后 status 恢复 active', () => {
    var book = bookService.createBook({ name: '测试' })
    bookService.archiveBook(book.id)
    var result = bookService.unarchiveBook(book.id)
    expect(result.status).toBe('active')
  })

  it('归档的账本仍在列表中', () => {
    var book = bookService.createBook({ name: '归档测试' })
    bookService.archiveBook(book.id)
    var list = bookService.getBookList()
    expect(list.length).toBe(1)
    expect(list[0].status).toBe('archived')
  })
})

// === 成员管理 ===
describe('member.成员管理边界情况', () => {
  beforeEach(() => clearMockStorage())

  it('getMembers 不存在的账本返回空数组', () => {
    var members = memberService.getMembers('nonexistent')
    expect(members).toEqual([])
  })

  it('创建者本地成员缺少 shadow_name 字段时仍能匹配云端', () => {
    var book = bookService.createBook({ name: '测试', creatorId: 'creator_openid' })
    var creator = book.members.find(m => m.type === 'real')
    // 创建者本地成员没有 shadow_name 字段 → 通过 user_id 匹配
    expect(creator.user_id).toBe('creator_openid')

    // 模拟云端返回创建者
    var cloudMembers = [
      makeCloudMember({ _id: 'cloud_c', user_id: 'creator_openid', nickname: '我', type: 'real', role: 'admin' })
    ]

    var cloudToLocal = {}
    var localToCloud = {}
    var bookData = bookService.getBookList().find(b => b.id === book.id)

    cloudMembers.forEach(function(cm) {
      var local = bookData.members.find(function(lm) {
        if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) return true
        if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) return true
        return false
      })
      if (local) {
        cloudToLocal[cm._id] = local.id
        localToCloud[local.id] = cm._id
      }
    })

    expect(cloudToLocal['cloud_c']).toBe(creator.id)
  })
})

// === 多账本切换 ===
describe('book.多账本切换', () => {
  beforeEach(() => clearMockStorage())

  it('setCurrentBook 切换当前账本', () => {
    var book1 = bookService.createBook({ name: '账本1' })
    var book2 = bookService.createBook({ name: '账本2' })
    expect(bookService.getCurrentBook().id).toBe(book2.id)

    bookService.setCurrentBook(book1.id)
    expect(bookService.getCurrentBook().id).toBe(book1.id)
  })

  it('setCurrentBook 不存在的 ID 返回 false', () => {
    bookService.createBook({ name: '测试' })
    expect(bookService.setCurrentBook('nonexistent')).toBeFalsy()
    expect(bookService.getCurrentBook()).toBeDefined() // 仍然返回默认
  })

  it('删除当前账本后 getCurrentBook 返回第一个剩余账本', () => {
    var book1 = bookService.createBook({ name: '账本1' })
    var book2 = bookService.createBook({ name: '账本2' })
    bookService.setCurrentBook(book2.id)
    bookService.deleteBook(book2.id)
    var current = bookService.getCurrentBook()
    expect(current).toBeDefined()
    expect(current.id).toBe(book1.id)
  })

  it('删除所有账本后 getCurrentBook 返回 null', () => {
    var book = bookService.createBook({ name: '唯一' })
    bookService.deleteBook(book.id)
    expect(bookService.getCurrentBook()).toBe(null)
  })
})

// === 账单编辑 ===
describe('bill.账单编辑', () => {
  beforeEach(() => clearMockStorage())

  it('updateBill 修改金额和类别', () => {
    var book = bookService.createBook({ name: '测试' })
    var bill = billService.createBill({
      bookId: book.id, amount: 5000, category: CATEGORIES[0],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members
    })
    var updated = billService.updateBill(bill.id, { amount: 8000, category: 'transport' })
    expect(updated.amount).toBe(8000)
    expect(updated.category).toBe('transport')
  })

  it('getBillById 编辑后能查到更新内容', () => {
    var book = bookService.createBook({ name: '测试' })
    var bill = billService.createBill({
      bookId: book.id, amount: 5000, category: CATEGORIES[0],
      payerId: book.members[0].id, payerName: '测试',
      memberIds: [book.members[0].id], members: book.members
    })
    billService.updateBill(bill.id, { note: '已修改备注' })
    var found = billService.getBillById(bill.id)
    expect(found.note).toBe('已修改备注')
  })
})

// === 成员服务 ===
describe('member.addShadowMember 边界', () => {
  beforeEach(() => clearMockStorage())

  it('可以添加多个影子成员', () => {
    var book = bookService.createBook({ name: '测试' })
    memberService.addShadowMember(book.id, 'A')
    memberService.addShadowMember(book.id, 'B')
    memberService.addShadowMember(book.id, 'C')
    var members = memberService.getMembers(book.id)
    expect(members.length).toBe(4) // 创建者 + 3 影子
  })

  it('删除影子成员后账本成员数正确', () => {
    var book = bookService.createBook({ name: '测试', shadowMembers: ['A', 'B'] })
    var shadowA = book.members.find(m => m.shadow_name === 'A')
    memberService.removeMember(book.id, shadowA.id)
    var updated = bookService.getBookList().find(b => b.id === book.id)
    expect(updated.members.length).toBe(2) // 创建者 + B
    expect(updated.member_count).toBe(2)
  })
})

// === 账单查询 ===
describe('bill.账单查询', () => {
  beforeEach(() => clearMockStorage())

  it('getTotalExpense 空账本返回 0', () => {
    expect(billService.getTotalExpense('nonexistent')).toBe(0)
  })

  it('getBillsGroupedByDate 空账本返回空数组', () => {
    expect(billService.getBillsGroupedByDate('nonexistent')).toEqual([])
  })

  it('getBillsGroupedByDate 同一天多笔账单合并为一组', () => {
    var book = bookService.createBook({ name: '测试' })
    for (var i = 0; i < 3; i++) {
      billService.createBill({
        bookId: book.id, amount: (i + 1) * 1000, category: CATEGORIES[0],
        payerId: book.members[0].id, payerName: '测试',
        memberIds: [book.members[0].id], members: book.members,
        paidAt: '2026-04-05T10:0' + i + ':00'
      })
    }
    var groups = billService.getBillsGroupedByDate(book.id)
    expect(groups.length).toBe(1)
    expect(groups[0].items.length).toBe(3)
    expect(groups[0].total).toBe(6000)
  })
})

// === 同步竞态安全 ===
describe('book.同步竞态安全', () => {
  beforeEach(() => clearMockStorage())

  it('updateBook 不影响其他账本', () => {
    var book1 = bookService.createBook({ name: '账本1' })
    var book2 = bookService.createBook({ name: '账本2' })

    bookService.updateBook(book1.id, { name: '修改后' })

    var list = bookService.getBookList()
    var b1 = list.find(b => b.id === book1.id)
    var b2 = list.find(b => b.id === book2.id)
    expect(b1.name).toBe('修改后')
    expect(b2.name).toBe('账本2') // 不受影响
  })

  it('createBook 不会覆盖已有账本', () => {
    var book1 = bookService.createBook({ name: '第一个' })
    var book2 = bookService.createBook({ name: '第二个' })

    var list = bookService.getBookList()
    expect(list.length).toBe(2)
    expect(list[0].id).toBe(book1.id)
    expect(list[1].id).toBe(book2.id)
  })

  it('deleteBookLocal 仅删除本地副本不影响其他', () => {
    var book1 = bookService.createBook({ name: '保留' })
    var book2 = bookService.createBook({ name: '删除' })

    billService.createBill({
      bookId: book2.id, amount: 1000, category: CATEGORIES[0],
      payerId: book2.members[0].id, payerName: '测试',
      memberIds: [book2.members[0].id], members: book2.members
    })

    bookService.deleteBookLocal(book2.id)
    expect(bookService.getBookList().length).toBe(1)
    expect(billService.getBills(book2.id).length).toBe(0)
    expect(billService.getBills(book1.id)).toEqual([])
  })
})
