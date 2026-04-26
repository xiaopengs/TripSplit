/**
 * 成员管理页面
 */
const bookService = require('../../services/book.service')
const memberService = require('../../services/member.service')

Page({
  data: {
    bookId: '',
    bookName: '',
    realMembers: [],
    shadowMembers: []
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return
    this.setData({ bookId: book.id, bookName: book.name || '' })
    this._loadMembers()
  },

  onShow() { this._loadMembers() },

  _loadMembers() {
    const members = memberService.getMembers(this.data.bookId)
    const addAvatarChar = list => list.map(m => ({
      ...m,
      avatar_char: (m.nickname || m.shadow_name || '?')[0] || '?'
    }))
    this.setData({
      realMembers: addAvatarChar(members.filter(m => m.type === 'real' || !m.type)),
      shadowMembers: addAvatarChar(members.filter(m => m.type === 'shadow'))
    })
  },

  onAddShadow() {
    wx.showModal({
      title: '添加影子成员', editable: true, placeholderText: '输入成员名称',
      confirmText: '添加', confirmColor: '#34C759',
      success: res => {
        if (res.confirm && res.content && res.content.trim()) {
          memberService.addShadowMember(this.data.bookId, res.content.trim())
          this._loadMembers()
          wx.showToast({ title: '已添加', icon: 'success' })
        }
      }
    })
  },

  onShareAppMessage(res) {
    const bookId = this.data.bookId
    const bookName = this.data.bookName

    if (!bookId) {
      return { title: '拼途记账', path: '/pages/index/index' }
    }

    // 使用 cloud_id 分享（本地 ID 在 B 端不存在）
    const book = bookService.getCurrentBook()
    const cloudId = book && book.cloud_id
    const title = bookName ? `邀请你加入「${bookName}」一起记账` : '邀请你一起记账'

    if (cloudId) {
      return {
        title,
        path: `/pages/invite/invite?cloudId=${encodeURIComponent(cloudId)}&from=share`
      }
    }

    wx.showToast({ title: '正在同步云端，请稍后再分享', icon: 'none' })
    return { title, path: '/pages/index/index' }
  },

  goBack() { wx.navigateBack() }
})
