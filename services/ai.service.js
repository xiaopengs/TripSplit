/**
 * AI OCR 服务
 * 处理拍照记账的图像识别
 */
const { generateInboxId } = require('../utils/id')
const cache = require('../utils/cache')
const { CATEGORIES, getCategoryByKey } = require('../utils/constants')

const INBOX_KEY = 'inbox_items'

/**
 * 拍照并上传
 * @param {Object} options - { sizeType: ['compressed'], sourceType: ['camera'] }
 * @returns {Promise<Object>} { localPath, cloudUrl }
 */
function takePhoto(options = {}) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: options.sizeType || ['compressed'],
      sourceType: options.sourceType || ['camera'],
      success(res) {
        const tempFile = res.tempFiles[0]
        resolve({
          localPath: tempFile.tempFilePath,
          size: tempFile.size
        })
      },
      fail(err) {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          reject({ cancelled: true })
        } else {
          reject(err)
        }
      }
    })
  })
}

/**
 * 上传图片到云端（云开发 OSS）
 * @param {string} filePath - 本地文件路径
 * @returns {Promise<string>} 云端 URL
 */
function uploadImage(filePath) {
  // TODO: 接入微信云开发存储或自建 OSS
  // 目前返回模拟数据
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`https://oss.tripsplit.com/images/${Date.now()}.jpg`)
    }, 500)
  })
}

/**
 * 调用 AI OCR 识别收据
 * @param {string} imageCloudUrl - 已上传的图片 URL
 * @returns {Promise<Object>} AI 识别结果
 * 
 * 返回格式:
 * {
 *   success: true,
 *   data: {
 *     amount: 18000,       // 分
 *     confidence: 0.92,     // 置信度 0~1
 *     category: 'traffic',  // 类目 key
 *     category_name: '交通',
 *     note: '机场出租车',    // AI 生成的备注
 *     raw_text: '...'       // 原始 OCR 文本
 *   }
 * }
 */
function recognizeReceipt(imageCloudUrl) {
  // TODO: 对接实际 AI API（百度/腾讯/Google Cloud Vision）
  // 这里先模拟返回，方便前端开发
  
  return new Promise(resolve => {
    // 模拟网络延迟
    setTimeout(() => {
      resolve({
        success: true,
        data: {
          amount: 18000 + Math.floor(Math.random() * 50000),
          confidence: 0.75 + Math.random() * 0.24,
          category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].key,
          note: '',
          raw_text: ''
        }
      })
    }, 1000 + Math.random() * 2000)
  })
}

/**
 * 完整的拍照→入库流程
 * 1. 调起相机拍照
 * 2. 立即创建 Inbox 记录（pending 状态）
 * 3. 上传图片到云端
 * 4. 异步调用 AI 识别
 * 5. 更新 Inbox 记录
 */
async function captureAndProcess(bookId, payerId, memberIds) {
  try {
    // Step 1: 拍照
    const photoResult = await takePhoto({ sourceType: ['camera'] })

    // Step 2: 创建 Inbox 本地记录（立即显示）
    const inboxItem = {
      id: generateInboxId(),
      book_id: bookId,
      image_local: photoResult.localPath,
      image_url: '',
      payer_id: payerId,
      
      ai_result: null,
      status: 'processing', // processing / pending / confirmed / rejected
      created_at: new Date().toISOString()
    }

    saveToInbox(inboxItem)

    // Step 3 & 4: 上传 + AI 识别（异步，不阻塞）
    processAsync(inboxItem.id, photoResult.localPath, bookId)

    return inboxItem
  } catch (err) {
    throw err
  }
}

/**
 * 后台异步处理
 */
async function processAsync(inboxId, localPath, bookId) {
  try {
    const imageUrl = await uploadImage(localPath)
    
    // 更新图片 URL
    updateInboxField(inboxId, 'image_url', imageUrl)

    const aiResult = await recognizeReceipt(imageUrl)
    
    // 更新 AI 结果
    if (aiResult.success) {
      updateInboxField(inboxId, 'ai_result', aiResult.data)
      updateInboxField(inboxId, 'status', 'pending') // 待用户确认
    } else {
      updateInboxField(inboxId, 'status', 'error')
    }
  } catch (err) {
    console.error('AI process error:', err)
    updateInboxField(inboxId, 'status', 'error')
  }
}

// === Inbox 本地操作 ===

function getInboxItems(bookId) {
  const items = cache.get(INBOX_KEY) || []
  return items.filter(i => i.book_id === bookId).sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )
}

function getUnreadCount(bookId) {
  const items = getInboxItems(bookId)
  return items.filter(i => i.status === 'pending' || i.status === 'processing').length
}

function saveToInbox(item) {
  const items = cache.get(INBOX_KEY) || []
  items.unshift(item)
  cache.set(INBOX_KEY, items)
}

function updateInboxField(id, field, value) {
  const items = cache.get(INBOX_KEY) || []
  const item = items.find(i => i.id === id)
  if (item) {
    item[field] = value
    cache.set(INBOX_KEY, items)
  }
}

function getInboxItemById(id) {
  const items = cache.get(INBOX_KEY) || []
  return items.find(i => i.id === id) || null
}

function confirmInboxItem(id) {
  updateInboxField(id, 'status', 'confirmed')
}

function rejectInboxItem(id) {
  updateInboxField(id, 'status', 'rejected')
}

module.exports = {
  takePhoto,
  uploadImage,
  recognizeReceipt,
  captureAndProcess,
  getInboxItems,
  getInboxItemById,
  getUnreadCount,
  confirmInboxItem,
  rejectInboxItem
}
