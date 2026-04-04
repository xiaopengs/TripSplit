/**
 * 全局常量定义
 */

// === 类目常量 ===
const CATEGORIES = [
  { key: 'dining', name: '餐饮', icon: '🍴' },
  { key: 'traffic', name: '交通', icon: '🚗' },
  { key: 'hotel', name: '住宿', icon: '🏨' },
  { key: 'ticket', name: '门票', icon: '🎫' },
  { key: 'shopping', name: '购物', icon: '🛍️' },
  { key: 'other', name: '其他', icon: '📦' }
]

function getCategoryByKey(key) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1]
}

// === 账本皮肤颜色 ===
const SKIN_COLORS = [
  { name: '森林绿', value: '#34C759', light: '#5ED47A' },
  { name: '海洋蓝', value: '#007AFF', light: '#409CFF' },
  { name: '暖阳橙', value: '#FF9500', light: '#FFB340' },
  { name: '玫瑰红', value: '#FF2D55', light: '#FF607D' },
  { name: '紫罗兰', value: '#AF52DE', light: '#C87DE6' },
  { name: '薄荷青', value: '#5AC8FA', light: '#85DBFB' }
]

function getSkinColor(index) {
  return SKIN_COLORS[index % SKIN_COLORS.length]
}

// === 币种 ===
const CURRENCIES = [
  { code: 'CNY', name: '人民币', symbol: '¥', flag: '🇨🇳' },
  { code: 'JPY', name: '日元', symbol: '¥', flag: '🇯🇵' },
  { code: 'USD', name: '美元', symbol: '$', flag: '🇺🇸' },
  { code: 'KRW', name: '韩元', symbol: '₩', flag: '🇰🇷' },
  { code: 'THB', name: '泰铢', symbol: '฿', flag: '🇹🇭' },
  { code: 'EUR', name: '欧元', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: '英镑', symbol: '£', flag: '🇬🇧' },
  { code: 'HKD', name: '港币', symbol: 'HK$', flag: '🇭🇰' }
]

function getCurrencyByCode(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
}

// === 账单来源 ===
const BILL_SOURCE = {
  MANUAL: 'manual',
  AI: 'ai',
  AI_CONFIRMED: 'ai_confirmed'
}

// === 成员类型 ===
const MEMBER_TYPE = {
  REAL: 'real',
  SHADOW: 'shadow'
}

// === 账本状态 ===
const BOOK_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
}

// === 分摊方式 ===
const SPLIT_TYPE = {
  EQUAL: 'equal',
  CUSTOM: 'custom'
}

module.exports = {
  CATEGORIES,
  getCategoryByKey,
  SKIN_COLORS,
  getSkinColor,
  CURRENCIES,
  getCurrencyByCode,
  BILL_SOURCE,
  MEMBER_TYPE,
  BOOK_STATUS,
  SPLIT_TYPE
}
