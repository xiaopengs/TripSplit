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
      roundToYuan: this.data.roundToYuan
    })

    // 预处理转账人首字（WXML 不支持 [0] 索引）
    if (result && result.transfers) {
      result.transfers.forEach(t => {
        t.from_char = (t.from_name || '?')[0] || '?'
        t.to_char = (t.to_name || '?')[0] || '?'
        t.amountDisplay = formatAmount(t.amount, this.data.currencySymbol)
      })
    }

    if (result.transfers.length > 0) {
      result.transfers.forEach(t => {
        t.amountDisplay = formatAmount(t.amount, this.data.currencySymbol)
      })
    }

    result.totalAmountDisplay = formatAmount(result.totalAmount, this.data.currencySymbol)

    this.setData({ result })
  },

  onRoundToggle(e) {
    this.setData({ roundToYuan: e.detail.value })
    this._calculate()
  },

  onMarkPaid(e) {
    const index = e.currentTarget.dataset.index
    const transfers = this.data.result.transfers
    transfers[index].status = 'paid'
    this.setData({ 'result.transfers': transfers })
    settleService.markTransferPaid(transfers[index].id)
    wx.showToast({ title: '已标记', icon: 'success' })
  },

  onForgive(e) {
    const index = e.currentTarget.dataset.index
    wx.showModal({
      title: '免除债务', content: '确定让这笔账"下顿他请"吗？',
      confirmText: '确认', confirmColor: '#34C759',
      success: res => {
        if (res.confirm) {
          const transfers = this.data.result.transfers
          transfers[index].status = 'forgiven'
          this.setData({ 'result.transfers': transfers })
          settleService.forgiveTransfer(transfers[index].id)
          wx.showToast({ title: '已免除', icon: 'success' })
        }
      }
    })
  },

  goBack() { wx.navigateBack() }
})
