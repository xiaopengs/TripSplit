/**
 * 金额格式化工具 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const { fenToYuan, formatAmount, yuanToFen, parseInputToFen, splitEqual } = require('../utils/currency')

// === 分→元 ===
describe('currency.fenToYuan 分转元', () => {
  beforeEach(() => clearMockStorage())

  it('100分 = "1.00"', () => {
    expect(fenToYuan(100)).toBe('1.00')
  })

  it('0分 = "0.00"', () => {
    expect(fenToYuan(0)).toBe('0.00')
  })

  it('999分 = "9.99"', () => {
    expect(fenToYuan(999)).toBe('9.99')
  })

  it('1000分 = "10.00"', () => {
    expect(fenToYuan(1000)).toBe('10.00')
  })

  it('5分 = "0.05"', () => {
    expect(fenToYuan(5)).toBe('0.05')
  })

  it('null = "0.00"', () => {
    expect(fenToYuan(null)).toBe('0.00')
  })

  it('undefined = "0.00"', () => {
    expect(fenToYuan(undefined)).toBe('0.00')
  })

  it('NaN = "0.00"', () => {
    expect(fenToYuan(NaN)).toBe('0.00')
  })

  it('负数 -500分 = "5.00" (取绝对值)', () => {
    expect(fenToYuan(-500)).toBe('5.00')
  })
})

// === 格式化金额 ===
describe('currency.formatAmount 格式化金额', () => {
  it('100分 = "¥1.00"', () => {
    expect(formatAmount(100)).toBe('¥1.00')
  })

  it('带千分位 100000分 = "¥1,000.00"', () => {
    expect(formatAmount(100000)).toBe('¥1,000.00')
  })

  it('大额 100000000分 = "¥1,000,000.00"', () => {
    expect(formatAmount(100000000)).toBe('¥1,000,000.00')
  })

  it('负数 -50000分 = "-¥500.00"', () => {
    expect(formatAmount(-50000)).toBe('-¥500.00')
  })

  it('自定义符号 $ 500分 = "$5.00"', () => {
    expect(formatAmount(500, '$')).toBe('$5.00')
  })

  it('null = "¥0.00"', () => {
    expect(formatAmount(null)).toBe('¥0.00')
  })

  it('0 = "¥0.00"', () => {
    expect(formatAmount(0)).toBe('¥0.00')
  })
})

// === 元→分 ===
describe('currency.yuanToFen 元转分', () => {
  it('"1" = 100分', () => {
    expect(yuanToFen('1')).toBe(100)
  })

  it('"1.50" = 150分', () => {
    expect(yuanToFen('1.50')).toBe(150)
  })

  it('"99.99" = 9999分', () => {
    expect(yuanToFen('99.99')).toBe(9999)
  })

  it('"0" = 0分', () => {
    expect(yuanToFen('0')).toBe(0)
  })

  it('null = 0分', () => {
    expect(yuanToFen(null)).toBe(0)
  })

  it('空字符串 = 0分', () => {
    expect(yuanToFen('')).toBe(0)
  })

  it('"0.01" = 1分', () => {
    expect(yuanToFen('0.01')).toBe(1)
  })
})

// === 解析输入 ===
describe('currency.parseInputToFen 解析用户输入', () => {
  it('"100" = 10000分', () => {
    expect(parseInputToFen('100')).toBe(10000)
  })

  it('"100.5" = 10050分', () => {
    expect(parseInputToFen('100.5')).toBe(10050)
  })

  it('"100.50" = 10050分', () => {
    expect(parseInputToFen('100.50')).toBe(10050)
  })

  it('含符号 "¥50" = 5000分', () => {
    expect(parseInputToFen('¥50')).toBe(5000)
  })

  it('空字符串 = 0', () => {
    expect(parseInputToFen('')).toBe(0)
  })

  it('null = 0', () => {
    expect(parseInputToFen(null)).toBe(0)
  })

  it('无效文本 "abc" = 0', () => {
    expect(parseInputToFen('abc')).toBe(0)
  })
})

// === 均分 ===
describe('currency.splitEqual 均分算法', () => {
  it('1000分3人均分 = [334, 333, 333] (余数给第1人)', () => {
    const result = splitEqual(1000, 3)
    expect(result.length).toBe(3)
    expect(result[0]).toBe(334)
    expect(result[1]).toBe(333)
    expect(result[2]).toBe(333)
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it('精确整除 600分3人 = [200, 200, 200]', () => {
    const result = splitEqual(600, 3)
    expect(result).toEqual([200, 200, 200])
  })

  it('0分3人 = [0, 0, 0]', () => {
    expect(splitEqual(0, 3)).toEqual([0, 0, 0])
  })

  it('0人 = 空数组', () => {
    expect(splitEqual(1000, 0)).toEqual([])
  })

  it('1人 = [1000]', () => {
    expect(splitEqual(1000, 1)).toEqual([1000])
  })

  it('5分2人均分 = [3, 2]', () => {
    const result = splitEqual(5, 2)
    expect(result.reduce((a, b) => a + b, 0)).toBe(5)
    expect(result[0] - result[1]).toBeGreaterThanOrEqual(0)
    expect(result[0] - result[1]).toBeLessThanOrEqual(1)
  })

  it('99分7人均分总额守恒', () => {
    const result = splitEqual(99, 7)
    expect(result.length).toBe(7)
    expect(result.reduce((a, b) => a + b, 0)).toBe(99)
  })

  it('大额 999999分11人均分总额守恒', () => {
    const result = splitEqual(999999, 11)
    expect(result.length).toBe(11)
    expect(result.reduce((a, b) => a + b, 0)).toBe(999999)
  })
})
