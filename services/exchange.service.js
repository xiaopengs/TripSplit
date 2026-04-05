/**
 * 汇率服务
 * 获取和缓存汇率数据
 */
const cache = require('../utils/cache')

const RATE_CACHE_KEY = 'exchange_rates'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 小时

// 基础汇率（以 CNY 为基准）
const BASE_RATES = {
  'CNY': { rate: 1, name: '人民币', symbol: '¥', flag: '🇨🇳' },
  'JPY': { rate: 20.5, name: '日元', symbol: '¥', flag: '🇯🇵' },    // 1 CNY ≈ 20.5 JPY
  'USD': { rate: 0.14, name: '美元', symbol: '$', flag: '🇺🇸' },     // 1 CNY ≈ 0.14 USD
  'KRW': { rate: 190, name: '韩元', symbol: '₩', flag: '🇰🇷' },      // 1 CNY ≈ 190 KRW
  'THB': { rate: 4.8, name: '泰铢', symbol: '฿', flag: '🇹🇭' },       // 1 CNY ≈ 4.8 THB
  'EUR': { rate: 0.13, name: '欧元', symbol: '€', flag: '🇪🇺' },     // 1 CNY ≈ 0.13 EUR
  'GBP': { rate: 0.11, name: '英镑', symbol: '£', flag: '🇬🇧' },     // 1 CNY ≈ 0.11 GBP
  'HKD': { rate: 1.08, name: '港币', symbol: 'HK$', flag: '🇭🇰' }    // 1 CNY ≈ 1.08 HKD
}

/**
 * 获取汇率（优先使用缓存）
 */
function getRates() {
  const cached = cache.get(RATE_CACHE_KEY)
  
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.rates
  }

  // 缓存过期或不存在，返回基础汇率并触发更新
  _fetchAndCache()
  return BASE_RATES
}

/**
 * 转换货币
 */
function convert(amountInFen, fromCurrency, toCurrency) {
  if (!amountInFen && amountInFen !== 0) return 0
  
  const rates = getRates()
  const fromRate = (rates[fromCurrency] && rates[fromCurrency].rate) || 1
  const toRate = (rates[toCurrency] && rates[toCurrency].rate) || 1

  // 先转为 CNY，再转为目标币种
  const cnyAmount = amountInFen / (fromRate * 100)
  const targetAmount = cnyAmount * toRate * 100

  return Math.round(targetAmount)
}

/**
 * 格式化带币种的金额显示
 */
function formatWithCurrency(fen, currencyCode) {
  const rates = getRates()
  const info = rates[currencyCode] || rates['CNY']
  const symbol = (info && info.symbol) || '¥'
  
  const yuan = Math.abs(fen) / 100
  const formatted = yuan.toFixed(2)
  const parts = formatted.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  return `${symbol}${parts.join('.')}`
}

/**
 * 从远程获取最新汇率并缓存
 */
async function _fetchAndCache() {
  try {
    // TODO: 对接真实汇率 API
    // const res = await request({ url: '/exchange/rates' })
    // cache.set(RATE_CACHE_KEY, { rates: res.data, timestamp: Date.now() })
    
    // 目前使用本地汇率
    cache.set(RATE_CACHE_KEY, { rates: BASE_RATES, timestamp: Date.now() })
  } catch (err) {
    console.error('Fetch exchange rates error:', err)
  }
}

module.exports = {
  getRates,
  convert,
  formatWithCurrency
}
