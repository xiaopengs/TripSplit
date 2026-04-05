/**
 * 精确计算工具 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const { add, subtract, multiply, divide, roundToYuan, sum } = require('../utils/calc')

// === 加法 ===
describe('calc.add 分单位加法', () => {
  beforeEach(() => clearMockStorage())

  it('基础加法 100 + 200 = 300', () => {
    expect(add(100, 200)).toBe(300)
  })

  it('含0 500 + 0 = 500', () => {
    expect(add(500, 0)).toBe(500)
  })

  it('null 安全 null + 100 = 100', () => {
    expect(add(null, 100)).toBe(100)
  })

  it('双 null null + null = 0', () => {
    expect(add(null, null)).toBe(0)
  })

  it('负数 -100 + 300 = 200', () => {
    expect(add(-100, 300)).toBe(200)
  })
})

// === 减法 ===
describe('calc.subtract 分单位减法', () => {
  it('基础减法 500 - 200 = 300', () => {
    expect(subtract(500, 200)).toBe(300)
  })

  it('归零 300 - 300 = 0', () => {
    expect(subtract(300, 300)).toBe(0)
  })

  it('负数结果 100 - 500 = -400', () => {
    expect(subtract(100, 500)).toBe(-400)
  })

  it('null 安全 null - 100 = -100', () => {
    expect(subtract(null, 100)).toBe(-100)
  })
})

// === 乘法 ===
describe('calc.multiply 分单位乘法', () => {
  it('3人均分 300分 = 100分/人', () => {
    expect(multiply(300, 1/3)).toBe(100)
  })

  it('乘2 150分 * 2 = 300分', () => {
    expect(multiply(150, 2)).toBe(300)
  })

  it('0乘数 500 * 0 = 0', () => {
    expect(multiply(500, 0)).toBe(0)
  })

  it('null 安全 null * 2 = 0', () => {
    expect(multiply(null, 2)).toBe(0)
  })

  it('小数乘法 333 * 0.33 ≈ 110 (四舍五入)', () => {
    // 333 * 0.33 * 100 / 100 = 109.89 → Math.round = 110
    const result = multiply(333, 0.33)
    expect(result).toBeGreaterThanOrEqual(109)
    expect(result).toBeLessThanOrEqual(110)
  })
})

// === 除法 ===
describe('calc.divide 分单位除法', () => {
  it('3人均分 1000分 / 3 = 333分', () => {
    expect(divide(1000, 3)).toBe(333)
  })

  it('精确整除 600 / 3 = 200', () => {
    expect(divide(600, 3)).toBe(200)
  })

  it('除以0返回0', () => {
    expect(divide(500, 0)).toBe(0)
  })

  it('null被除数 null / 3 = 0', () => {
    expect(divide(null, 3)).toBe(0)
  })
})

// === 抹零 ===
describe('calc.roundToYuan 抹零到元', () => {
  it('249分 -> 200分 (四舍)', () => {
    expect(roundToYuan(249)).toBe(200)
  })

  it('250分 -> 300分 (五入)', () => {
    expect(roundToYuan(250)).toBe(300)
  })

  it('恰好整元 1000分 -> 1000分', () => {
    expect(roundToYuan(1000)).toBe(1000)
  })

  it('0分 -> 0分', () => {
    expect(roundToYuan(0)).toBe(0)
  })

  it('null返回0', () => {
    expect(roundToYuan(null)).toBe(0)
  })

  it('99分 -> 100分', () => {
    expect(roundToYuan(99)).toBe(100)
  })
})

// === 求和 ===
describe('calc.sum 数组求和', () => {
  it('空数组返回0', () => {
    expect(sum([])).toBe(0)
  })

  it('null返回0', () => {
    expect(sum(null)).toBe(0)
  })

  it('正常求和 [100, 200, 300] = 600', () => {
    expect(sum([100, 200, 300])).toBe(600)
  })

  it('含null元素 [100, null, 300] = 400', () => {
    expect(sum([100, null, 300])).toBe(400)
  })

  it('单元素 [500] = 500', () => {
    expect(sum([500])).toBe(500)
  })
})
