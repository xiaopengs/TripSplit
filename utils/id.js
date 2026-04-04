/**
 * ID 生成工具
 */

function generateId(prefix = '') {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`
}

function generateBillId() {
  return generateId('bill')
}

function generateBookId() {
  return generateId('book')
}

function generateMemberId() {
  return generateId('mem')
}

function generateInboxId() {
  return generateId('inbox')
}

function generateRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

module.exports = {
  generateId,
  generateBillId,
  generateBookId,
  generateMemberId,
  generateInboxId,
  generateRequestId
}
