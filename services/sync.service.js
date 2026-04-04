/**
 * 数据同步服务
 * 管理离线队列和网络恢复后的自动同步
 */
const cache = require('../utils/cache')
const { request } = require('../utils/request')

const OFFLINE_QUEUE_KEY = 'offline_queue'
const SYNC_PENDING_KEY = 'sync_pending'

/**
 * 将操作加入离线队列
 */
function enqueue(action, data) {
  const queue = cache.get(OFFLINE_QUEUE_KEY) || []
  queue.push({
    id: data.request_id || `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action, // 'create_bill', 'update_bill', 'claim_member', etc.
    data,
    created_at: Date.now(),
    retries: 0
  })
  cache.set(OFFLINE_QUEUE_KEY, queue)
}

/**
 * 同步离线队列（FIFO）
 */
async function syncOfflineQueue() {
  const queue = cache.get(OFFLINE_QUEUE_KEY) || []
  if (queue.length === 0) return

  console.log(`[Sync] Starting sync, ${queue.length} items in queue`)

  const failed = []
  
  for (const item of queue) {
    try {
      await _syncItem(item)
      console.log(`[Sync] ✅ ${item.action} synced`)
    } catch (err) {
      item.retries++
      if (item.retries < 3) {
        failed.push(item)
        console.warn(`[Sync] ⚠️ ${item.action} retry ${item.retries}`)
      } else {
        console.error(`[Sync] ❌ ${item.action} failed after 3 retries`)
      }
    }
  }

  // 更新队列（保留失败的）
  cache.set(OFFLINE_QUEUE_KEY, failed)

  if (failed.length === 0) {
    wx.showToast({ title: '数据已同步', icon: 'success' })
  } else if (failed.length < queue.length) {
    wx.showToast({ title: `${failed.length}条待同步`, icon: 'none' })
  }
}

async function _syncItem(item) {
  switch (item.action) {
    case 'create_bill':
      return request({
        url: '/bills',
        method: 'POST',
        data: item.data
      })
    case 'update_bill':
      return request({
        url: `/bills/${item.data.id}`,
        method: 'PUT',
        data: item.data
      })
    default:
      throw new Error(`Unknown action: ${item.action}`)
  }
}

/**
 * 增量同步账单数据（基于时间戳 diff）
 */
async function incrementalSync(bookId, lastSyncTime) {
  try {
    const result = await request({
      url: `/books/${bookId}/bills`,
      method: 'GET',
      data: { since: lastSyncTime },
      skipOfflineCheck: true
    })

    // 合并远程数据到本地...
    return result
  } catch (err) {
    console.error('Incremental sync error:', err)
    return null
  }
}

module.exports = {
  enqueue,
  syncOfflineQueue,
  incrementalSync
}
