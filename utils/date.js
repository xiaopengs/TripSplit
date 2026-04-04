/**
 * 日期时间工具
 */

/**
 * 格式化日期
 */
function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  
  const map = {
    'YYYY': d.getFullYear(),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0')
  }
  
  let result = fmt
  for (const [key, value] of Object.entries(map)) {
    result = result.replace(key, value)
  }
  return result
}

/**
 * 获取星期几
 */
function getWeekDay(date) {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = typeof date === 'string' ? new Date(date) : date
  return days[d.getDay()]
}

/**
 * 格式化为 "01月08日 星期四" 格式
 */
function formatChineseDate(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}月${day}日 ${getWeekDay(d)}`
}

/**
 * 格式化为 "01月08日 星期四 19:30" 格式
 */
function formatDateTimeCN(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${getWeekDay(d)} ${hour}:${minute}`
}

/**
 * 判断是否是今天
 */
function isToday(dateStr) {
  const today = new Date()
  const d = new Date(dateStr)
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

/**
 * 判断是否是昨天
 */
function isYesterday(dateStr) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const d = new Date(dateStr)
  return d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
}

/**
 * 获取友好时间描述（今天、昨天、具体日期）
 */
function getFriendlyDate(dateStr) {
  if (isToday(dateStr)) return '今天'
  if (isYesterday(dateStr)) return '昨天'
  return formatDate(dateStr, 'MM月DD日')
}

module.exports = {
  formatDate,
  getWeekDay,
  formatChineseDate,
  formatDateTimeCN,
  isToday,
  isYesterday,
  getFriendlyDate
}
