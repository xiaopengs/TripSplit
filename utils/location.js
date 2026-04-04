/**
 * 定位工具
 */

/**
 * 获取当前位置信息
 * @returns {Promise<Object>} { latitude, longitude, province, city, district }
 */
function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        // 逆地理编码获取城市
        reverseGeocode(res.latitude, res.longitude)
          .then(address => {
            resolve({
              latitude: res.latitude,
              longitude: res.longitude,
              ...address
            })
          })
          .catch(() => {
            resolve({ latitude: res.latitude, longitude: res.longitude })
          })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/**
 * 逆地理编码：经纬度 → 地址
 */
function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    // 使用微信内置的逆编码（需要开通相关服务）
    // 或调用外部 API
    // 这里先用简化版本
    resolve({ province: '', city: '', district: '' })
  })
}

/**
 * 根据定位判断默认币种
 * 境外 → 当地货币；境内 → CNY
 */
function detectCurrency(city, country) {
  const overseasMap = {
    '日本': 'JPY', '东京': 'JPY', '大阪': 'JPY',
    '韩国': 'KRW', '首尔': 'KRW',
    '泰国': 'THB', '曼谷': 'THB', '清迈': 'THB',
    '美国': 'USD', '纽约': 'USD', '洛杉矶': 'USD',
    '英国': 'GBP', '伦敦': 'GBP',
    '欧元区': 'EUR', '法国': 'EUR', '巴黎': 'EUR',
    '德国': 'EUR', '柏林': 'EUR', '意大利': 'EUR'
  }

  if (country && overseasMap[country]) return overseasMap[country]
  if (city && overseasMap[city]) return overseasMap[city]
  
  return 'CNY' // 默认人民币
}

module.exports = {
  getLocation,
  reverseGeocode,
  detectCurrency
}
