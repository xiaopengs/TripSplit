Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    detail: {
      type: Object,
      value: null
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('onclose')
    },
    preventMove() {}
  }
})
