/**
 * 本地缓存工具 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage, setMockStorage } = require('./wx.mock')
const cache = require('../utils/cache')

describe('cache.set / cache.get 基础读写', () => {
  beforeEach(() => clearMockStorage())

  it('存入字符串并读取', () => {
    cache.set('name', 'test')
    expect(cache.get('name')).toBe('test')
  })

  it('存入对象并读取', () => {
    const obj = { a: 1, b: 'hello' }
    cache.set('obj', obj)
    expect(cache.get('obj')).toEqual(obj)
  })

  it('存入数组并读取', () => {
    const arr = [1, 2, 3]
    cache.set('arr', arr)
    expect(cache.get('arr')).toEqual(arr)
  })

  it('存入数字并读取', () => {
    cache.set('num', 42)
    expect(cache.get('num')).toBe(42)
  })

  it('存入 null 并读取返回 null', () => {
    cache.set('null_key', null)
    // null 经 JSON.stringify 后变为 "null"，读取时 JSON.parse 回来
    expect(cache.get('null_key')).toBe(null)
  })

  it('存入布尔值并读取', () => {
    cache.set('flag', true)
    expect(cache.get('flag')).toBeTruthy()
  })

  it('读取不存在的 key 返回 null', () => {
    expect(cache.get('nonexistent')).toBe(null)
  })
})

describe('cache.remove 删除', () => {
  beforeEach(() => clearMockStorage())

  it('删除已存在的 key', () => {
    cache.set('temp', 'value')
    cache.remove('temp')
    expect(cache.get('temp')).toBe(null)
  })

  it('删除不存在的 key 不报错', () => {
    cache.remove('nonexistent')
    // 如果到这里没报错就算通过
    expect(true).toBeTruthy()
  })
})

describe('cache.clearAll 清空', () => {
  beforeEach(() => clearMockStorage())

  it('清空所有 ts_ 前缀的数据', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    // 直接写入一个非 ts_ 前缀的数据
    wx.setStorageSync('other_key', 'preserved')
    cache.clearAll()
    expect(cache.get('a')).toBe(null)
    expect(cache.get('b')).toBe(null)
    expect(wx.getStorageSync('other_key')).toBe('preserved')
  })
})

describe('cache 键名前缀隔离', () => {
  beforeEach(() => clearMockStorage())

  it('ts_ 前缀确保键名隔离', () => {
    cache.set('user', 'trip_data')
    // 直接访问不带前缀的 key
    expect(wx.getStorageSync('user')).toBe('')
    expect(wx.getStorageSync('ts_user')).toBeTruthy()
  })
})
