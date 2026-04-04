/**
 * 精确计算工具（分单位整数运算）
 * 严禁使用浮点数进行金额计算
 */

/**
 * 分单位加法
 */
function add(a, b) {
  return (a || 0) + (b || 0)
}

/**
 * 分单位减法
 */
function subtract(a, b) {
  return (a || 0) - (b || 0)
}

/**
 * 分单位乘法
 * @param {number} amount - 以分为单位的金额
 * @param {number} multiplier - 乘数
 * @returns {number} 四舍五入到分的整数
 */
function multiply(amount, multiplier) {
  if (!amount || !multiplier) return 0
  return Math.round((amount * multiplier * 100)) / 100
}

/**
 * 分单位除法
 * @param {number} amount - 被除数（分）
 * @param {number} divisor - 除数
 * @returns {number} 向下取整到分
 */
function divide(amount, divisor) {
  if (!divisor) return 0
  return Math.floor((amount || 0) / divisor)
}

/**
 * 抹零：四舍五入到元（返回分）
 */
function roundToYuan(fen) {
  if (!fen && fen !== 0) return 0
  const yuan = Math.round(fen / 100)
  return yuan * 100
}

/**
 * 计算数组总和
 */
function sum(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((total, val) => total + (val || 0), 0)
}

module.exports = {
  add,
  subtract,
  multiply,
  divide,
  roundToYuan,
  sum
}
