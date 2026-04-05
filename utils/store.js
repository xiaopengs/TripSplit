/**
 * 全局状态管理 - 纯内存发布订阅模式
 * 持久化统一由 cache.js 负责，此处仅管理运行时状态
 */
class TripStore {
  constructor() {
    this._state = {
      currentBook: null,
      members: [],
      bills: [],
      inbox: [],
      inboxUnread: 0,
      userInfo: null,
      online: true,
      offlineQueue: []
    }
    this._listeners = {}
  }

  getState(key) {
    if (key) return this._state[key]
    return Object.assign({}, this._state)
  }

  setState(key, value) {
    const oldValue = this._state[key]
    this._state[key] = value
    this._emit(key, value, oldValue)
  }

  subscribe(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = []
    this._listeners[key].push(callback)
    return () => this.unsubscribe(key, callback)
  }

  unsubscribe(key, callback) {
    if (!this._listeners[key]) return
    this._listeners[key] = this._listeners[key].filter(cb => cb !== callback)
  }

  _emit(key, newValue, oldValue) {
    const listeners = this._listeners[key]
    if (!listeners || listeners.length === 0) return
    listeners.forEach(cb => {
      try { cb(newValue, oldValue) } catch (e) { console.error('Store listener error:', e) }
    })
  }

  /**
   * 重置某个 key 的状态
   */
  reset(key) {
    this.setState(key, null)
  }

  /**
   * 更新嵌套对象属性
   */
  updateNested(key, path, value) {
    const obj = Object.assign({}, this._state[key])
    let current = obj
    const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {}
      current[keys[i]] = Object.assign({}, current[keys[i]])
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    this.setState(key, obj)
  }
}

module.exports = new TripStore()
