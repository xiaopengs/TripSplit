/**
 * 首页 / 流水列表页
 * 核心页面，包含流水、待整理、结算三个 Tab
 */
const app = getApp()
const store = require('../../utils/store')
const bookService = require('../../services/book.service')
const billService = require('../../services/bill.service')
const aiService = require('../../services/ai.service')
const settleService = require('../../services/settle.service')
const memberService = require('../../services/member.service')
const cache = require('../../utils/cache')
const { formatAmount, fenToYuan } = require('../../utils/currency')
const { SKIN_COLORS, getSkinColor, CATEGORIES, getCategoryByKey } = require('../../utils/constants')
const { formatChineseDate, formatDateTimeCN, formatDate } = require('../../utils/date')

Page({
  data: {
    // 账本信息
    currentBook: null,
    bookColor: '#34C759',
    bookColorLight: '#5ED47A',
    memberCount: 0,
    currencySymbol: '¥',

    // 多账本管理
    bookList: [],
    currentBookIndex: 0,

    // Tab 状态
    activeTab: 'flow',

    // 流水数据
    groupedBills: [],

    // 待整理数据
    inboxItems: [],
    inboxUnread: 0,

    // 结算数据
    settlementResult: null,

    // 成员
    members: [],
    pendingClaimCount: 0,
    myMemberId: '',

    // 弹窗状态
    memberPopupVisible: false,
    addPanelVisible: false,
    detailVisible: false,
    selectedBill: null,

    // 导航栏高度
    navPaddingTop: 0,
    navPaddingBottom: 0
  },

  onLoad(options) {
    this._calcNavHeight()
    this._handleEntryOptions(options)
    this.loadBookData()
    this._setupStoreSubscriptions()
  },

  onShow() {
    this.refreshData()
  },

  onPullDownRefresh() {
    this.refreshData(() => wx.stopPullDownRefresh())
  },

  _handleEntryOptions(options) {
    const bookId = options && options.bookId
    const from = options && options.from
    if (!bookId) return

    const switched = bookService.setCurrentBook(bookId)
    if (switched) return

    if (from === 'share') {
      // 非本机账本 → 跳转邀请页面
      wx.redirectTo({
        url: `/pages/invite/invite?bookId=${encodeURIComponent(bookId)}&from=share`
      })
    }
  },

  onShareAppMessage(res) {
    const data = (res && res.target && res.target.dataset) || {}
    // 重新从缓存读取最新数据（cloud_id 可能已通过后台同步更新）
    const book = bookService.getCurrentBook()
    const bookId = data.bookId || (book && book.id) || ''
    const bookName = data.bookName || (book && book.name) || ''
    const cloudId = book && book.cloud_id

    if (!bookId) {
      return { title: '拼途记账', path: '/pages/index/index' }
    }

    const title = bookName ? `邀请你加入「${bookName}」一起记账` : '邀请你一起记账'

    // 必须使用 cloud_id 分享（本地 ID 在云端不存在，B 打开会报错）
    if (cloudId) {
      return {
        title,
        path: `/pages/invite/invite?cloudId=${encodeURIComponent(cloudId)}&from=share`
      }
    }

    // cloud_id 尚未同步完成，提示用户稍后再分享
    wx.showToast({ title: '正在同步云端，请稍后再分享', icon: 'none' })
    return { title, path: '/pages/index/index' }
  },

  /**
   * 加载账本基础数据
   */
  loadBookData() {
    const book = bookService.getCurrentBook()
    if (!book) {
      // 没有账本时清空状态并加载账本列表
      const allBooks = bookService.getBookList()
      this.setData({
        currentBook: null,
        bookList: allBooks,
        currentBookIndex: 0,
        members: [],
        memberCount: 0,
        groupedBills: [],
        settlementResult: null,
        pendingClaimCount: 0
      })
      return
    }

    const skin = book.cover_color ?
      SKIN_COLORS.find(s => s.value === book.cover_color) || getSkinColor(0) :
      getSkinColor(0)

    // 加载所有账本用于切换
    const allBooks = bookService.getBookList()
    const currentIdx = allBooks.findIndex(b => b.id === book.id)

    this.setData({
      currentBook: book,
      bookColor: skin.value,
      bookColorLight: skin.light,
      memberCount: book.member_count || (book.members || []).length,
      currencySymbol: book.currency_symbol || '¥',
      members: book.members || [],
      bookList: allBooks,
      currentBookIndex: currentIdx >= 0 ? currentIdx : 0,
      myMemberId: this._getMyMemberId(book)
    })

    this._updatePendingCount(book.members || [])

    // 后台同步云端成员+账单数据（如果有云连接）
    if (book.cloud_id || book.cloud_db_id) {
      bookService.syncCloudMembers(book.id).then(synced => {
        if (synced === 'deleted') {
          // 云端已删除，重新加载
          this.loadBookData()
          return
        }
        if (synced) {
          const updated = bookService.getCurrentBook()
          if (updated) {
            const newMyMemberId = this._getMyMemberId(updated)
            this.setData({
              members: updated.members || [],
              memberCount: updated.member_count || (updated.members || []).length,
              myMemberId: newMyMemberId
            })
            this._updatePendingCount(updated.members || [])

            // 同步完成后刷新账单和结算（使用更新后的 myMemberId）
            const bookId = updated.id
            const grouped = billService.getBillsGroupedByDate(bookId)
            this._formatGroupedBills(grouped)
            this._calculateSettlement()
          }
        }
      }).catch(() => {})
    }
  },

  /**
   * 刷新所有数据
   */
  refreshData(callback) {
    // 先重新加载账本数据（可能已被删除）
    this.loadBookData()

    if (!this.data.currentBook) {
      callback && callback()
      return
    }

    const bookId = this.data.currentBook.id

    // 加载流水
    const grouped = billService.getBillsGroupedByDate(bookId)
    this._formatGroupedBills(grouped)

    // MVP: 暂不加载待整理
    // this._loadInbox()

    // 计算结算
    this._calculateSettlement()

    callback && callback()
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })

    if (tab === 'settle') {
      this._calculateSettlement()
    }
  },

  // === FAB 操作 ===

  onFabSelect(e) {
    const key = e.detail.key
    switch (key) {
      case 'manual':
        this.openAddPanel()
        break
      case 'camera':
        this.handleCameraCapture()
        break
    }
  },

  // === 手动记账 ===

  // 多账本切换
  onBookSwitch(e) {
    const idx = e.detail.value
    const books = this.data.bookList
    if (!books[idx] || (this.data.currentBook && books[idx].id === this.data.currentBook.id)) return
    bookService.setCurrentBook(books[idx].id)
    this.loadBookData()
    this.refreshData()
  },

  openAddPanel() {
    if (!this.data.currentBook) {
      wx.showToast({ title: '请先创建账本', icon: 'none' })
      return
    }
    this.setData({ addPanelVisible: true })
  },

  closeAddPanel() {
    this.setData({ addPanelVisible: false })
  },

  async onAddBillSubmit(e) {
    const formData = e.detail
    
    try {
      app.showLoading('保存中...')
      
      const bill = billService.createBill({
        bookId: this.data.currentBook.id,
        amount: formData.amount,
        category: formData.category,
        note: formData.note,
        images: formData.images || [],
        location: formData.location || '',
        payerId: formData.payerId || (this.data.members[0] && this.data.members[0].id),
        payerName: formData.payerName || (this.data.members[0] && (this.data.members[0].nickname || '我')),
        memberIds: formData.memberIds || this.data.members.map(m => m.id),
        members: this.data.members,
        splitType: formData.splitType || 'equal',
        customSplits: formData.customSplits,
        paidAt: formData.paidAt || new Date().toISOString(),
        source: 'manual'
      })

      app.hideLoading()
      this.closeAddPanel()
      this.refreshData()
      
      wx.showToast({ title: '已记录', icon: 'success' })
    } catch (err) {
      app.hideLoading()
      console.error('Create bill error:', err)
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // === AI 拍照记账 ===

  async handleCameraCapture() {
    if (!this.data.currentBook) {
      wx.showToast({ title: '请先创建账本', icon: 'none' })
      return
    }

    try {
      const result = await aiService.captureAndProcess(
        this.data.currentBook.id,
        (this.data.members.find(function(m) { return m.type === 'real' }) || {}).id,
        this.data.members.map(function(m) { return m.id })
      )

      wx.showToast({ title: '拍照成功，识别中...', icon: 'none' })
      this.refreshData()
      
      // 延迟后刷新 Inbox（等待 AI 处理）
      setTimeout(() => {
        this._loadInbox()
        this.setData({ activeTab: 'inbox' })
      }, 2500)

    } catch (err) {
      if (err.cancelled) return
      console.error('Camera error:', err)
      wx.showToast({ title: '拍照失败', icon: 'none' })
    }
  },

  // === 待整理操作（MVP 暂不上线） ===
  /*
  _loadInbox() {
    if (!this.data.currentBook) return
    
    const items = aiService.getInboxItems(this.data.currentBook.id)
    const unread = aiService.getUnreadCount(this.data.currentBook.id)

    items.forEach(item => {
      if (item.ai_result) {
        item.ai_result.amountDisplay = formatAmount(item.ai_result.amount, this.data.currencySymbol)
      }
    })

    this.setData({
      inboxItems: items,
      inboxUnread: unread
    })
  },

  onConfirmInbox(e) {
    const id = e.currentTarget.dataset.id
    const inboxItem = aiService.getInboxItemById(id)

    if (!inboxItem || !inboxItem.ai_result) {
      wx.showToast({ title: '识别结果为空', icon: 'none' })
      return
    }

    const aiData = inboxItem.ai_result
    const catInfo = getCategoryByKey(aiData.category)

    // Create bill from AI result
    try {
      billService.createBill({
        bookId: this.data.currentBook.id,
        amount: aiData.amount,
        category: catInfo || { key: aiData.category || 'other', name: aiData.category_name || '其他' },
        note: aiData.note || '',
        images: inboxItem.image_url ? [inboxItem.image_url] : [],
        payerId: inboxItem.payer_id || (this.data.members[0] && this.data.members[0].id),
        payerName: (this.data.members.find(m => m.id === inboxItem.payer_id) || this.data.members[0] || {}).nickname || '我',
        memberIds: this.data.members.map(m => m.id),
        members: this.data.members,
        splitType: 'equal',
        paidAt: inboxItem.created_at || new Date().toISOString(),
        source: 'ai_confirmed',
        aiConfidence: aiData.confidence
      })

      aiService.confirmInboxItem(id)
      this.refreshData()
      wx.showToast({ title: '已入账', icon: 'success' })
    } catch (err) {
      console.error('Confirm inbox error:', err)
      wx.showToast({ title: '入账失败', icon: 'none' })
    }
  },

  onRejectInbox(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: res => {
        if (res.confirm) {
          aiService.rejectInboxItem(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this._loadInbox()
        }
      }
    })
  },

  onRetryInbox(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: '重新识别中...', icon: 'loading' })
    // TODO: 重新触发 AI 识别
  },
  */

  // === 成员管理 ===

  onMemberTap() {
    this.setData({ memberPopupVisible: true })
  },

  closeMemberPopup() {
    this.setData({ memberPopupVisible: false })
  },

  onAddShadowMember(e) {
    const name = e.detail.name
    if (!name.trim()) return

    const member = memberService.addShadowMember(this.data.currentBook.id, name.trim())
    if (member) {
      this.loadBookData()
      wx.showToast({ title: `已添加 ${name}`, icon: 'success' })
    }
  },

  // === 账单详情 ===

  onBillTap(e) {
    const id = e.currentTarget.dataset.id
    const bill = billService.getBillById(id)
    if (!bill) return

    // 为详情弹窗添加视角解析
    bill.payer_name_display = this._resolvePayerName(bill, this.data.myMemberId, this.data.members)

    this.setData({
      selectedBill: bill,
      detailVisible: true
    })
  },

  closeDetailPopup() {
    this.setData({ detailVisible: false, selectedBill: null })
  },

  onDeleteBill(e) {
    const id = e.detail && e.detail.id
    if (!id) return

    try {
      billService.deleteBill(id)
      this.setData({ detailVisible: false, selectedBill: null })
      this.refreshData()
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (err) {
      console.error('Delete bill error:', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  // === 结算操作 ===

  onMarkPaid(e) {
    const id = e.currentTarget.dataset.id
    const transfer = this.data.settlementResult.transfers.find(t => t.id === id)
    if (!transfer) return
    settleService.markTransferPaid(transfer)
    this._calculateSettlement()
    wx.showToast({ title: '已标记', icon: 'success' })
  },

  onForgive(e) {
    const id = e.currentTarget.dataset.id
    const transfer = this.data.settlementResult.transfers.find(t => t.id === id)
    if (!transfer) return
    wx.showModal({
      title: '确认免除',
      content: '确定让这笔账"下顿他请"吗？',
      confirmText: '确认',
      confirmColor: '#34C759',
      success: res => {
        if (res.confirm) {
          settleService.forgiveTransfer(transfer)
          this._calculateSettlement()
          wx.showToast({ title: '已免除', icon: 'success' })
        }
      }
    })
  },

  onUndoSettle(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '撤销操作',
      content: '确定撤销此笔结算状态吗？',
      confirmText: '撤销',
      confirmColor: '#FF9500',
      success: res => {
        if (res.confirm) {
          settleService.unmarkTransfer(id)
          this._calculateSettlement()
          wx.showToast({ title: '已撤销', icon: 'success' })
        }
      }
    })
  },

  // === 创建账本跳转 ===

  onCreateBook() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  // === 账本管理跳转 ===

  onManageBooks() {
    wx.navigateTo({ url: '/pages/books/books' })
  },

  // === 私有方法 ===

  /**
   * 计算自定义导航栏高度
   * 需要避开状态栏和微信胶囊按钮
   */
  _calcNavHeight() {
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect()
      // 导航栏顶部padding = 胶囊按钮距顶部的距离
      // 导航栏底部padding = 胶囊按钮底部 + 额外间距 - header-content 的 padding-top
      const paddingTop = menuBtn.top
      // 让 header-content 的上边缘对齐到胶囊按钮中心
      // menuBtn.top + menuBtn.height/2 是胶囊中心 Y
      // header-content padding-top 为 24rpx ≈ 12px
      // 所以 navPaddingTop 应让整个区域从胶囊顶部开始
      this.setData({
        navPaddingTop: paddingTop,
        navPaddingBottom: menuBtn.top + menuBtn.height - paddingTop
      })
    } catch (e) {
      // 回退：使用安全区
      this.setData({
        navPaddingTop: 20,
        navPaddingBottom: 24
      })
    }
  },

  _formatGroupedBills(grouped) {
    var self = this
    var myMemberId = this.data.myMemberId
    var members = this.data.members

    var formatted = grouped.map(function(group) {
      var items = group.items.map(function(bill) {
        var catInfo = getCategoryByKey(bill.category)
        return Object.assign({}, bill, {
          category_icon: (catInfo && catInfo.icon) || '📦',
          category_name: (catInfo && catInfo.name) || bill.category_name || '其他',
          amountDisplay: formatAmount(bill.amount, self.data.currencySymbol),
          timeDisplay: formatDate(bill.paid_at, 'HH:mm'),
          // 根据当前用户视角解析付款人名称
          payer_name_display: self._resolvePayerName(bill, myMemberId, members)
        })
      })
      return Object.assign({}, group, {
        dateLabel: formatChineseDate(group.date),
        totalDisplay: formatAmount(group.total, self.data.currencySymbol),
        items: items
      })
    })
    this.setData({ groupedBills: formatted })
  },

  /**
   * 根据当前用户视角解析付款人名称
   * 当前用户的付款 → "我"，其他人的付款 → 显示其实际名称
   * 注意：创建者本地昵称默认为"我"，但这个"我"不应展示给其他用户
   */
  _resolvePayerName(bill, myMemberId, members) {
    if (bill.payer_id === myMemberId && myMemberId) {
      return '我'
    }
    // 从成员列表中查找实际名称
    var member = members.find(function(m) { return m.id === bill.payer_id })
    if (member) {
      var name = member.nickname || ''
      // "我"是视角代词，不是真实名称，对其他用户不应显示
      if (name === '我') {
        name = member.shadow_name || ''
      }
      if (!name && member.role === 'admin') name = '创建者'
      if (!name) name = '成员'
      return name
    }
    return bill.payer_name || '未知'
  },

  _getMyMemberId(book) {
    try {
      var openid = app.globalData.openid
      if (!openid || !book || !book.members) return ''
      var myMember = book.members.find(function(m) { return m.user_id === openid })
      return myMember ? myMember.id : ''
    } catch (e) {
      return ''
    }
  },

  _calculateSettlement() {
    if (!this.data.currentBook) return

    const result = settleService.calculateSettlement(
      this.data.members,
      billService.getBills(this.data.currentBook.id),
      { bookId: this.data.currentBook.id }
    )

    if (result.transfers.length > 0) {
      result.transfers.forEach(t => {
        t.amountDisplay = formatAmount(t.totalAmount, this.data.currencySymbol)
        t.pendingAmountDisplay = formatAmount(t.pendingAmount, this.data.currencySymbol)
        t.settledAmountDisplay = formatAmount(t.settledAmount, this.data.currencySymbol)
      })
    }

    result.pendingAmountDisplay = formatAmount(result.pendingAmount, this.data.currencySymbol)

    this.setData({ settlementResult: result })
  },

  _updatePendingCount(members) {
    const count = members.filter(
      m => m.type === 'shadow' && !m.is_claimed
    ).length
    this.setData({ pendingClaimCount: count })
  },

  _setupStoreSubscriptions() {
    // 监听全局状态变化（可选）
  }
})
