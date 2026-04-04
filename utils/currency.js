/**
 * 金额格式化工具
 * 所有金额在内部以「分」（整数）为单位存储和计算
 * 仅在显示时转换为「元」
 */

/**
 * 分 → 元（字符串，保留2位小数）
 */
function fenToYuan(fen) {
  if (fen === null || fen === undefined || isNaN(fen)) return '0.00'
  const yuan = Math.abs(fen) / 100
  return yuan.toFixed(2)
}

/**
 * 分 → 元（带符号的格式化字符串）
 * @param {number} fen - 以分为单位的金额
 * @param {string} symbol - 货币符号，默认 ¥
 */
function formatAmount(fen, symbol = '¥') {
  if (fen === null || fen === undefined) return `${symbol}0.00`
  const isNegative = fen < 0
  const absFen = Math.abs(fen)
  const yuan = absFen / 100
  // 格式化为千分位
  let formatted = yuan.toFixed(2)
  const parts = formatted.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  formatted = parts.join('.')
  
  const prefix = isNegative ? '-' : ''
  return `${prefix}${symbol}${formatted}`
}

/**
 * 元 → 分（整数）
 */
function yuanToFen(yuan) {
  if (!yuan && yuan !== 0) return 0
  return Math.round(parseFloat(yuan) * 100)
}

/**
 * 解析用户输入的金额字符串为分
 * 支持 "100" "100.5" "100.50" 格式
 */
function parseInputToFen(input) {
  if (!input) return 0
  const cleaned = input.replace(/[^\d.]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * 计算均分后的每人份额（分），余数给第一个人
 * @param {number} totalAmount - 总金额（分）
 * @param {number} personCount - 人数
 * @returns {Array<number>} 每人份额数组
 */
function splitEqual(totalAmount, personCount) {
  if (personCount <= 0) return []
  const share = Math.floor(totalAmount / personCount)
  const remainder = totalAmount - share * personCount
  
  const shares = new Array(personCount).fill(share)
  for (let i = 0; i < remainder; i++) {
    shares[i] += 1
  }
  return shares
}

module.exports = {
  fenToYuan,
  formatAmount,
  yuanToFen,
  parseInputToFen,
  splitEqual
}
