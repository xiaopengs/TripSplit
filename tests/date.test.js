/**
 * 日期工具 - 单元测试
 */
const { describe, it, expect, runSuites } = require('./test.helper')
const { formatDate, getWeekDay, formatChineseDate, formatDateTimeCN, isToday, isYesterday, getFriendlyDate } = require('../utils/date')

// === formatDate ===
describe('date.formatDate 格式化日期', () => {
  it('默认格式 YYYY-MM-DD', () => {
    const result = formatDate('2026-04-05')
    expect(result).toBe('2026-04-05')
  })

  it('完整时间 YYYY-MM-DD HH:mm:ss', () => {
    const result = formatDate('2026-04-05T14:30:00', 'YYYY-MM-DD HH:mm:ss')
    expect(result).toBe('2026-04-05 14:30:00')
  })

  it('null 返回空字符串', () => {
    expect(formatDate(null)).toBe('')
  })

  it('undefined 返回空字符串', () => {
    expect(formatDate(undefined)).toBe('')
  })

  it('Date 对象', () => {
    const d = new Date(2026, 3, 5, 9, 5, 8) // 月份从0开始
    expect(formatDate(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-04-05 09:05:08')
  })

  it('补零 1月1日', () => {
    expect(formatDate('2026-01-01')).toBe('2026-01-01')
  })
})

// === getWeekDay ===
describe('date.getWeekDay 获取星期', () => {
  it('2026-04-05 是周日', () => {
    expect(getWeekDay('2026-04-05')).toBe('星期日')
  })

  it('2026-04-06 是周一', () => {
    expect(getWeekDay('2026-04-06')).toBe('星期一')
  })

  it('Date 对象', () => {
    expect(getWeekDay(new Date(2026, 3, 9))).toBe('星期四')
  })

  it('所有星期覆盖', () => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 3, 5 + i) // 2026-04-05 起
      expect(getWeekDay(d)).toBe(days[i])
    }
  })
})

// === formatChineseDate ===
describe('date.formatChineseDate 中文日期', () => {
  it('2026-04-05', () => {
    const result = formatChineseDate('2026-04-05')
    expect(result).toContain('04月05日')
    expect(result).toContain('星期')
  })

  it('null 返回空字符串', () => {
    expect(formatChineseDate(null)).toBe('')
  })
})

// === formatDateTimeCN ===
describe('date.formatDateTimeCN 中文日期时间', () => {
  it('2026-04-05T14:30:00', () => {
    const result = formatDateTimeCN('2026-04-05T14:30:00')
    expect(result).toContain('04月05日')
    expect(result).toContain('14:30')
  })

  it('null 返回空字符串', () => {
    expect(formatDateTimeCN(null)).toBe('')
  })
})

// === isToday ===
describe('date.isToday 判断今天', () => {
  it('今天的日期返回 true', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T12:00:00`
    expect(isToday(todayStr)).toBeTruthy()
  })

  it('昨天的日期返回 false', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isToday(yesterday.toISOString())).toBeFalsy()
  })

  it('明天的日期返回 false', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(isToday(tomorrow.toISOString())).toBeFalsy()
  })
})

// === isYesterday ===
describe('date.isYesterday 判断昨天', () => {
  it('昨天的日期返回 true', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isYesterday(yesterday.toISOString())).toBeTruthy()
  })

  it('今天的日期返回 false', () => {
    expect(isYesterday(new Date().toISOString())).toBeFalsy()
  })
})

// === getFriendlyDate ===
describe('date.getFriendlyDate 友好日期', () => {
  it('今天返回"今天"', () => {
    expect(getFriendlyDate(new Date().toISOString())).toBe('今天')
  })

  it('昨天返回"昨天"', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(getFriendlyDate(yesterday.toISOString())).toBe('昨天')
  })

  it('更早的日期返回 MM月DD日 格式', () => {
    const old = new Date(2026, 0, 15)
    expect(getFriendlyDate(old.toISOString())).toBe('01月15日')
  })
})
