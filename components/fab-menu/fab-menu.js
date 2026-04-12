/**
 * FAB 浮动按钮组件
 * 圆形 + 号，点击直接触发手动录入
 * 事件：select（{ key: 'manual' }）
 *
 * MVP 暂只保留手动录入，后续恢复文字/语音/拍照时：
 * - 恢复 options 数据、展开面板 WXML 和对应样式
 * - 将 onTap 改回 onToggle 展开面板
 *
Component({
  data: {
    expanded: false,
    options: [
      { key: 'manual', icon: '✏️', label: '手动录入', desc: '逐项填写金额和类目', active: true },
      { key: 'text', icon: '📝', label: '文字输入', desc: '即将上线', active: false },
      { key: 'voice', icon: '🎙', label: '语音记账', desc: '即将上线', active: false },
      { key: 'camera', icon: '📷', label: '拍照识别', desc: '拍小票自动识别', active: true }
    ]
  },
  methods: {
    onToggle() {
      wx.vibrateShort({ type: 'light' })
      this.setData({ expanded: !this.data.expanded })
    },
    onOverlayTap() {
      this.setData({ expanded: false })
    },
    onSelect(e) {
      const key = e.currentTarget.dataset.key
      this.setData({ expanded: false })
      wx.vibrateShort({ type: 'medium' })
      this.triggerEvent('select', { key })
    }
  }
})
*/
Component({
  methods: {
    onTap() {
      wx.vibrateShort({ type: 'light' })
      this.triggerEvent('select', { key: 'manual' })
    }
  }
})
