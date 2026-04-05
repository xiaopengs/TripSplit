/**
 * 成员管理服务 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const bookService = require('../services/book.service')
const memberService = require('../services/member.service')
const billService = require('../services/bill.service')
const { CATEGORIES } = require('../utils/constants')

describe('member.addShadowMember 添加影子成员', () => {
  beforeEach(() => clearMockStorage())

  it('成功添加影子成员', () => {
    const book = bookService.createBook({ name: '测试' })
    const member = memberService.addShadowMember(book.id, '大壮')
    
    expect(member).toBeDefined()
    expect(member.type).toBe('shadow')
    expect(member.shadow_name).toBe('大壮')
    expect(member.is_claimed).toBeFalsy()
  })

  it('添加后 member_count 增加', () => {
    const book = bookService.createBook({ name: '测试' })
    const before = book.member_count
    memberService.addShadowMember(book.id, '大壮')
    memberService.addShadowMember(book.id, '二狗')
    
    const updated = bookService.getBookList().find(b => b.id === book.id)
    expect(updated.member_count).toBe(before + 2)
  })

  it('不存在的账本返回 null', () => {
    expect(memberService.addShadowMember('nonexistent', '大壮')).toBe(null)
  })
})

describe('member.getMembers 获取成员列表', () => {
  beforeEach(() => clearMockStorage())

  it('返回账本全部成员', () => {
    const book = bookService.createBook({ name: '测试', shadowMembers: ['大壮', '二狗'] })
    const members = memberService.getMembers(book.id)
    expect(members.length).toBe(3)
  })
})

describe('member.claimShadowMember 认领影子身份', () => {
  beforeEach(() => clearMockStorage())

  it('成功认领', () => {
    const book = bookService.createBook({ name: '测试', shadowMembers: ['大壮'] })
    const shadowMember = book.members.find(m => m.shadow_name === '大壮')
    
    const result = memberService.claimShadowMember(
      book.id,
      shadowMember.id,
      'wx_user_123',
      { nickName: '大壮本尊', avatarUrl: 'https://example.com/avatar.jpg' }
    )
    
    expect(result).toBeTruthy()
    
    // 验证已更新
    const updatedBook = bookService.getBookList().find(b => b.id === book.id)
    const claimed = updatedBook.members.find(m => m.id === shadowMember.id)
    expect(claimed.is_claimed).toBeTruthy()
    expect(claimed.claimed_by).toBe('wx_user_123')
    expect(claimed.nickname).toBe('大壮本尊')
  })

  it('重复认领返回 false', () => {
    const book = bookService.createBook({ name: '测试', shadowMembers: ['大壮'] })
    const shadowMember = book.members.find(m => m.shadow_name === '大壮')
    
    memberService.claimShadowMember(book.id, shadowMember.id, 'user1', {})
    const result = memberService.claimShadowMember(book.id, shadowMember.id, 'user2', {})
    
    expect(result).toBeFalsy()
  })

  it('认领后账单归属迁移', () => {
    const book = bookService.createBook({ name: '测试', shadowMembers: ['大壮'] })
    const shadowMember = book.members.find(m => m.shadow_name === '大壮')
    
    // 以影子成员身份创建账单
    billService.createBill({
      bookId: book.id,
      amount: 10000,
      category: CATEGORIES[0],
      payerId: shadowMember.id,
      payerName: '大壮',
      memberIds: book.members.map(m => m.id),
      members: book.members
    })

    // 认领
    memberService.claimShadowMember(book.id, shadowMember.id, 'wx_real_user', {})

    // 验证账单归属已迁移
    const bills = billService.getBills(book.id)
    expect(bills[0].payer_id).toBe(shadowMember.id)
    const split = bills[0].splits.find(s => s.member_id === shadowMember.id)
    expect(split).toBeDefined()
    expect(split.is_shadow).toBeFalsy()
  })
})

describe('member.removeMember 移除成员', () => {
  beforeEach(() => clearMockStorage())

  it('成功移除成员', () => {
    const book = bookService.createBook({ name: '测试', shadowMembers: ['大壮', '二狗'] })
    const shadowMember = book.members.find(m => m.shadow_name === '大壮')
    
    const result = memberService.removeMember(book.id, shadowMember.id)
    expect(result).toBeTruthy()
    
    const updated = bookService.getBookList().find(b => b.id === book.id)
    expect(updated.members.length).toBe(2)
  })

  it('移除不存在的成员返回 false', () => {
    const book = bookService.createBook({ name: '测试' })
    expect(memberService.removeMember(book.id, 'nonexistent')).toBeFalsy()
  })

  it('不存在的账本返回 false', () => {
    expect(memberService.removeMember('nonexistent', 'any')).toBeFalsy()
  })
})
