/**
 * 待整理收件箱页面
 */
const aiService = require('../../services/ai.service')
const bookService = require('../../services/book.service')
const { fenToYuan } = require('../../utils/currency')

Page({
  data: {
    items: [],
    unreadCount: 0,
    bookId: ''
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return
    this.setData({ bookId: book.id })
  },

  onShow() {
    this._loadData()
  },

  _loadData() {
    const items = aiService.getInboxItems(this.data.bookId)
    const unread = aiService.getUnreadCount(this.data.bookId)

    items.forEach(item => {
      if (item.ai_result) {
        item.ai_result.amountYuan = fenToYuan(item.ai_result.amount)
      }
    })

    this.setData({ items, unreadCount: unread })
  },

  onConfirm(e) {
    const id = e.currentTarget.dataset.id
    aiService.confirmInboxItem(id)
    wx.showToast({ title: '已入账', icon: 'success' })
    this._loadData()
  },

  onReject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除', content: '确定删除这条识别结果？',
      confirmColor: '#FF3B30',
      success: res => {
        if (res.confirm) {
          aiService.rejectInboxItem(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this._loadData()
        }
      }
    })
  },

  onEdit(e) {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  onRetry(e) {
    wx.showToast({ title: '重新识别中...', icon: 'loading' })
  },

  previewImage(e) {
    wx.previewImage({ current: e.currentTarget.dataset.url, urls: [e.currentTarget.dataset.url] })
  },

  goBack() { wx.navigateBack() }
})
