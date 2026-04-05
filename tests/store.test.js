/**
 * 全局状态管理 Store - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const store = require('../utils/store')

describe('store.setState / getState', () => {
  beforeEach(() => {
    clearMockStorage()
    store.reset('currentBook')
    store.reset('members')
    store.reset('bills')
    store.reset('inbox')
  })

  it('设置并获取单个 key', () => {
    store.setState('currentBook', { id: 'book1', name: '测试' })
    expect(store.getState('currentBook').name).toBe('测试')
  })

  it('获取不存在的 key 返回 undefined/null', () => {
    expect(store.getState('nonexistent')).toBeFalsy()
  })

  it('获取全部 state', () => {
    store.setState('currentBook', { id: 'b1' })
    const state = store.getState()
    expect(state.currentBook).toBeDefined()
    expect(state.online).toBe(true)
  })
})

describe('store.subscribe 发布订阅', () => {
  beforeEach(() => {
    clearMockStorage()
    store.reset('bills')
  })

  it('订阅 key 变化被触发', () => {
    let received = null
    store.subscribe('bills', (newValue) => { received = newValue })
    store.setState('bills', [{ id: '1' }])
    expect(received).toEqual([{ id: '1' }])
  })

  it('多次订阅都能触发', () => {
    let count1 = 0, count2 = 0
    store.subscribe('bills', () => count1++)
    store.subscribe('bills', () => count2++)
    store.setState('bills', [1])
    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })

  it('取消订阅不再触发', () => {
    let count = 0
    const unsub = store.subscribe('bills', () => count++)
    unsub()
    store.setState('bills', [1])
    expect(count).toBe(0)
  })

  it('不同 key 互不干扰', () => {
    let billsChanged = false
    let membersChanged = false
    store.subscribe('bills', () => billsChanged = true)
    store.subscribe('members', () => membersChanged = true)
    
    store.setState('bills', [1])
    expect(billsChanged).toBeTruthy()
    expect(membersChanged).toBeFalsy()
  })
})

describe('store.updateNested 嵌套更新', () => {
  beforeEach(() => {
    clearMockStorage()
    store.reset('currentBook')
  })

  it('更新嵌套属性', () => {
    store.setState('currentBook', { id: 'b1', name: '旧', meta: { count: 0 } })
    store.updateNested('currentBook', 'meta.count', 5)
    expect(store.getState('currentBook').meta.count).toBe(5)
    expect(store.getState('currentBook').name).toBe('旧')
  })
})

describe('store.reset 重置', () => {
  beforeEach(() => {
    clearMockStorage()
  })

  it('重置 key 为 null', () => {
    store.setState('currentBook', { id: 'b1' })
    store.reset('currentBook')
    expect(store.getState('currentBook')).toBe(null)
  })
})
