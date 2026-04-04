Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    buttons: {
      type: Array,
      value: [
        { key: 'manual', icon: 'edit', label: '手动记一笔' },
        { key: 'camera', icon: 'camera', label: '拍照记账' }
      ]
    }
  },

  data: {},

  methods: {
    onShow() {
      wx.vibrateShort({ type: 'light' })
      this.triggerEvent('show')
    },

    onHide() {
      this.triggerEvent('hide')
    },

    onToggle() {
      const newVal = !this.data.visible
      if (newVal) {
        wx.vibrateShort({ type: 'light' })
      }
      this.triggerEvent('toggle', { visible: newVal })
    },

    onSelect(e) {
      const key = e.currentTarget.dataset.key
      this.triggerEvent('onselect', { key })
    },

    preventMove() {}
  }
})
