/**
 * 金额键盘组件
 * 3×4 网格：7-8-9 / 4-5-6 / 1-2-3 / .-0-⌫
 */
Component({
  properties: {
    value: {
      type: String,
      value: ''
    }
  },

  data: {
    keys: [
      ['7', '8', '9'],
      ['4', '5', '6'],
      ['1', '2', '3'],
      ['.', '0', '⌫']
    ]
  },

  methods: {
    onKeyTap(e) {
      const key = e.currentTarget.dataset.key
      wx.vibrateShort({ type: 'light' })

      if (key === '⌫') {
        this.triggerEvent('onbackspace')
      } else {
        this.triggerEvent('oninput', { detail: key })
      }
    }
  }
})
