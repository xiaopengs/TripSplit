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
    result: null
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return

    this.setData({
      bookId: book.id,
      members: book.members || [],
      currencySymbol: book.currency_symbol || '¥'
    })

    this._calculate()
  },

  onShow() {
    this._calculate()
  },

  _calculate() {
    const bills = billService.getBills(this.data.bookId)
    const result = settleService.calculateSettlement(this.data.members, bills, {
      roundToYuan: this.data.roundToYuan,
      bookId: this.data.bookId
    })

    // 预处理显示数据
    if (result && result.transfers) {
      result.transfers.forEach(t => {
        t.from_char = (t.from_name || '?')[0] || '?'
        t.to_char = (t.to_name || '?')[0] || '?'
        t.amountDisplay = formatAmount(t.totalAmount, this.data.currencySymbol)
        t.pendingAmountDisplay = formatAmount(t.pendingAmount, this.data.currencySymbol)
        t.settledAmountDisplay = formatAmount(t.settledAmount, this.data.currencySymbol)
      })
    }

    result.totalAmountDisplay = formatAmount(result.totalAmount, this.data.currencySymbol)
    result.pendingAmountDisplay = formatAmount(result.pendingAmount, this.data.currencySymbol)

    this.setData({ result })
  },

  onRoundToggle(e) {
    this.setData({ roundToYuan: e.detail.value })
    this._calculate()
  },

  onMarkPaid(e) {
    const index = e.currentTarget.dataset.index
    const transfer = this.data.result.transfers[index]
    settleService.markTransferPaid(transfer)
    wx.showToast({ title: '已标记', icon: 'success' })
    this._calculate()
  },

  onForgive(e) {
    const index = e.currentTarget.dataset.index
    const transfer = this.data.result.transfers[index]
    wx.showModal({
      title: '免除债务', content: '确定让这笔账"下顿他请"吗？',
      confirmText: '确认', confirmColor: '#34C759',
      success: res => {
        if (res.confirm) {
          settleService.forgiveTransfer(transfer)
          wx.showToast({ title: '已免除', icon: 'success' })
          this._calculate()
        }
      }
    })
  },

  onUndo(e) {
    const index = e.currentTarget.dataset.index
    const transfers = this.data.result.transfers
    const transfer = transfers[index]

    wx.showModal({
      title: '撤销操作',
      content: '确定撤销此笔结算状态吗？',
      confirmText: '撤销', confirmColor: '#FF9500',
      success: res => {
        if (res.confirm) {
          settleService.unmarkTransfer(transfer.id)
          wx.showToast({ title: '已撤销', icon: 'success' })
          this._calculate()
        }
      }
    })
  },

  onResetAll() {
    wx.showModal({
      title: '重置结算',
      content: '确定重置所有结算状态吗？所有已标记的转账将恢复为待结算。',
      confirmText: '全部重置', confirmColor: '#FF3B30',
      success: res => {
        if (res.confirm) {
          settleService.resetAllStatuses()
          wx.showToast({ title: '已重置', icon: 'success' })
          this._calculate()
        }
      }
    })
  },

  goBack() { wx.navigateBack() }
})
