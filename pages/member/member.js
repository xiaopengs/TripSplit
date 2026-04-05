/**
 * 成员管理页面
 */
const bookService = require('../../services/book.service')
const memberService = require('../../services/member.service')

Page({
  data: {
    bookId: '',
    realMembers: [],
    shadowMembers: []
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return
    this.setData({ bookId: book.id })
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

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  },

  goBack() { wx.navigateBack() }
})
