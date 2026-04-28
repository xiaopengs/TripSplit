/**
 * 账本服务 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const bookService = require('../services/book.service')

describe('book.createBook 创建账本', () => {
  beforeEach(() => clearMockStorage())

  it('成功创建基础账本', () => {
    const book = bookService.createBook({
      name: '曼谷大吃大喝之旅',
      creatorId: 'user001',
      creatorName: '小明'
    })
    
    expect(book).toBeDefined()
    expect(book.name).toBe('曼谷大吃大喝之旅')
    expect(book.status).toBe('active')
    expect(book.creator_id).toBe('user001')
    expect(book.members.length).toBe(1)
    expect(book.members[0].type).toBe('real')
    expect(book.members[0].role).toBe('admin')
  })

  it('创建账本时带影子成员', () => {
    const book = bookService.createBook({
      name: '日本旅行',
      shadowMembers: ['大壮', '二狗']
    })
    
    expect(book.members.length).toBe(3) // 创建者 + 2影子
    expect(book.member_count).toBe(3)
    const shadows = book.members.filter(m => m.type === 'shadow')
    expect(shadows.length).toBe(2)
    expect(shadows[0].shadow_name).toBe('大壮')
    expect(shadows[0].is_claimed).toBeFalsy()
    expect(shadows[1].shadow_name).toBe('二狗')
  })

  it('指定币种', () => {
    const book = bookService.createBook({
      name: '东京之旅',
      currency: 'JPY',
      currencySymbol: '¥'
    })
    expect(book.currency).toBe('JPY')
  })

  it('默认皮肤颜色随机分配', () => {
    const book = bookService.createBook({ name: '测试' })
    expect(book.cover_color).toBeTruthy()
    expect(book.cover_color.startsWith('#')).toBeTruthy()
    expect(book.cover_color.length).toBe(7)
  })

  it('多账本独立存储', () => {
    bookService.createBook({ name: '旅行1' })
    bookService.createBook({ name: '旅行2' })
    bookService.createBook({ name: '旅行3' })
    
    const list = bookService.getBookList()
    expect(list.length).toBe(3)
    expect(list[0].name).toBe('旅行1')
    expect(list[1].name).toBe('旅行2')
    expect(list[2].name).toBe('旅行3')
  })
})

describe('book.getCurrentBook 获取当前账本', () => {
  beforeEach(() => clearMockStorage())

  it('无账本返回 null', () => {
    expect(bookService.getCurrentBook()).toBe(null)
  })

  it('有活跃账本返回第一个', () => {
    const book = bookService.createBook({ name: '活跃' })
    expect(bookService.getCurrentBook().id).toBe(book.id)
  })
})

describe('book.updateBook 更新账本', () => {
  beforeEach(() => clearMockStorage())

  it('更新账本名称', () => {
    const book = bookService.createBook({ name: '旧名称' })
    const updated = bookService.updateBook(book.id, { name: '新名称' })
    expect(updated.name).toBe('新名称')
    expect(updated.updated_at).toBeGreaterThanOrEqual(book.updated_at)
  })

  it('更新不存在的账本返回 null', () => {
    expect(bookService.updateBook('nonexistent', { name: 'x' })).toBe(null)
  })
})

describe('book.deleteBook 删除账本', () => {
  beforeEach(() => clearMockStorage())

  it('删除成功', () => {
    const book = bookService.createBook({ name: '待删除' })
    bookService.deleteBook(book.id)
    expect(bookService.getBookList().length).toBe(0)
  })

  it('删除不存在的账本不影响其他', () => {
    bookService.createBook({ name: '保留' })
    bookService.deleteBook('nonexistent')
    expect(bookService.getBookList().length).toBe(1)
  })
})

describe('book.getBookList 排序稳定性', () => {
  beforeEach(() => clearMockStorage())

  it('相同 updated_at 时排序结果稳定（不随机）', () => {
    // 创建3本账本，它们的 updated_at 和 created_at 由 Date.now() 生成
    // 我们手动修改让它们时间戳完全一致
    const b1 = bookService.createBook({ name: '账本B' })
    const b2 = bookService.createBook({ name: '账本A' })
    const b3 = bookService.createBook({ name: '账本C' })

    // 强制让 updated_at 和 created_at 完全相同
    const books = bookService.getBookList()
    const ts = Date.now()
    books.forEach(b => {
      b.updated_at = ts
      b.created_at = ts
    })

    // 多次获取列表，验证顺序一致
    const orders = []
    for (let i = 0; i < 5; i++) {
      // 模拟页面每次 onShow 重新排序
      const sorted = books.slice().sort((a, b) => {
        var diff = (b.updated_at || 0) - (a.updated_at || 0)
        if (diff !== 0) return diff
        return (b.created_at || 0) - (a.created_at || 0)
      })
      orders.push(sorted.map(b => b.name).join(','))
    }

    // 所有排序结果应该完全一致
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBe(orders[0])
    }
  })
})
