/**
 * FAB 浮动菜单组件
 * 主按钮始终可见，展开后显示遮罩 + 两个垂直排列的子按钮
 * 事件：toggle（切换展开/收起）、select（选择子项 { key }）
 */
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    /**
     * 切换展开/收起
     */
    onToggle() {
      wx.vibrateShort({ type: 'light' })
      this.triggerEvent('toggle')
    },

    /**
     * 点击遮罩关闭
     */
    onOverlayTap() {
      this.triggerEvent('toggle')
    },

    /**
     * 选择子按钮
     */
    onSelect(e) {
      const key = e.currentTarget.dataset.key
      wx.vibrateShort({ type: 'medium' })
      this.triggerEvent('select', { key })
    },

    /**
     * 阻止遮罩层滚动穿透
     */
    preventMove() {}
  }
})
