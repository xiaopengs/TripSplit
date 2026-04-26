/**
 * 账单详情弹窗组件
 */
const { formatAmount, fenToYuan } = require('../../utils/currency')
const { getCategoryByKey } = require('../../utils/constants')
const { formatDateTimeCN } = require('../../utils/date')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    bill: {
      type: Object,
      value: null
    },
    currencySymbol: {
      type: String,
      value: '¥'
    }
  },

  observers: {
    'bill': function(bill) {
      if (!bill) return
      
      // 格式化账单数据
      const catInfo = getCategoryByKey(bill.category)
      const formatted = Object.assign({}, bill, {
        category_icon: (catInfo && catInfo.icon) || '📦',
        amountDisplay: formatAmount(bill.amount, this.data.currencySymbol),
        timeDisplay: formatDateTimeCN(bill.paid_at),
        splits: (bill.splits || []).map(function(s) {
          return Object.assign({}, s, {
            shareDisplay: formatAmount(s.share, this.data.currencySymbol)
          })
        }.bind(this))
      })

      this.setData({ _formattedBill: formatted })
    }
  },

  data: {
    _formattedBill: null
  },

  methods: {
    onClose() {
      this.triggerEvent('onclose')
    },

    preventMove() {},

    previewImage(e) {
      const url = e.currentTarget.dataset.url
      const fb = this.data._formattedBill
      const images = (fb && fb.images) || []
      wx.previewImage({ current: url, urls: images })
    },

    onEdit() {
      this.triggerEvent('onedit', { bill: this.data.bill })
    },

    onDelete() {
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复，确定删除这笔记录吗？',
        confirmColor: '#FF3B30',
        success: res => {
          if (res.confirm) {
            var billId = this.data.bill && this.data.bill.id
            this.triggerEvent('ondelete', { id: billId })
            this.triggerEvent('onclose')
          }
        }
      })
    }
  }
})
