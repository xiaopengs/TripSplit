/**
 * 结算中心页面
 */
const settleService = require('../../services/settle.service')
const billService = require('../../services/bill.service')
const bookService = require('../../services/book.service')
const { formatAmount } = require('../../utils/currency')

Page({
  data: {
    bookId: '',
    members: [],
    currencySymbol: '¥',
    roundToYuan: false,
    result: null,
    myMemberId: '',
    settleDetailVisible: false,
    settleDetailData: null,
    refreshing: false
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return

    var myMemberId = ''
    try {
      var openid = getApp().globalData.openid
      if (openid && book.members) {
        var myMember = book.members.find(function(m) { return m.user_id === openid })
        if (myMember) myMemberId = myMember.id
      }
    } catch (e) {}

    this.setData({
      bookId: book.id,
      members: book.members || [],
      currencySymbol: book.currency_symbol || '¥',
      myMemberId: myMemberId
    })

    this._calculate()
  },

  onShow() {
    const book = bookService.getCurrentBook()
    if (!book) return

    var myMemberId = ''
    try {
      var openid = getApp().globalData.openid
      if (openid && book.members) {
        var myMember = book.members.find(function(m) { return m.user_id === openid })
        if (myMember) myMemberId = myMember.id
      }
    } catch (e) {}

    this.setData({
      bookId: book.id,
      members: book.members || [],
      currencySymbol: book.currency_symbol || '¥',
      myMemberId: myMemberId
    })

    this._calculate()
  },

  /**
   * 下拉刷新：同步云端数据
   */
  onRefresh() {
    var self = this
    var book = bookService.getCurrentBook()
    if (!book) {
      this.setData({ refreshing: false })
      return
    }

    this._calculate()

    var hasCloud = book.cloud_id || book.cloud_db_id
    if (!hasCloud) {
      this.setData({ refreshing: false })
      return
    }

    bookService.syncCloudMembers(book.id).then(function() {
      var updated = bookService.getCurrentBook()
      if (updated) {
        var myMemberId = ''
        try {
          var openid = getApp().globalData.openid
          if (openid && updated.members) {
            var myMember = updated.members.find(function(m) { return m.user_id === openid })
            if (myMember) myMemberId = myMember.id
          }
        } catch (e) {}

        self.setData({
          members: updated.members || [],
          myMemberId: myMemberId
        })
      }
      self._calculate()
      self.setData({ refreshing: false })
    }).catch(function() {
      self.setData({ refreshing: false })
    })
  },

  _resolveName(memberId) {
    if (memberId === this.data.myMemberId && this.data.myMemberId) return '我'
    var member = this.data.members.find(function(m) { return m.id === memberId })
    if (member) {
      if (member.is_claimed || member.type === 'real') {
        return member.nickname || member.shadow_name || '成员'
      }
      return member.shadow_name || member.nickname || '成员'
    }
    return '未知'
  },

  _calculate() {
    const bills = billService.getBills(this.data.bookId)
    const result = settleService.calculateSettlement(this.data.members, bills, {
      roundToYuan: this.data.roundToYuan,
      bookId: this.data.bookId
    })

    var self = this
    if (result && result.transfers) {
      result.transfers.forEach(t => {
        var fromDisplay = self._resolveName(t.from_id)
        var toDisplay = self._resolveName(t.to_id)
        t.from_name = fromDisplay
        t.to_name = toDisplay
        t.from_char = (fromDisplay || '?')[0] || '?'
        t.to_char = (toDisplay || '?')[0] || '?'
        t.amountDisplay = formatAmount(t.amount, this.data.currencySymbol)
      })
      if (result.memberSummary) {
        result.memberSummary.forEach(m => {
          m.name = self._resolveName(m.id)
          m.paidDisplay = formatAmount(m.paid, self.data.currencySymbol)
          m.shareDisplay = formatAmount(m.share, self.data.currencySymbol)
          m.netDisplay = formatAmount(Math.abs(m.net), self.data.currencySymbol)
        })
      }
    }

    result.totalAmountDisplay = formatAmount(result.totalAmount, this.data.currencySymbol)

    this.setData({ result })
  },

  onRoundToggle(e) {
    this.setData({ roundToYuan: e.detail.value })
    this._calculate()
  },

  onTransferTap(e) {
    var index = e.currentTarget.dataset.index
    var transfers = (this.data.result || {}).transfers || []
    var t = transfers[index]
    if (!t) return
    this.setData({
      settleDetailVisible: true,
      settleDetailData: {
        transfer: t,
        memberSummary: (this.data.result || {}).memberSummary || []
      }
    })
  },

  closeSettleDetail() {
    this.setData({ settleDetailVisible: false })
  },

  goBack() { wx.navigateBack() }
})
