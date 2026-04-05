/**
 * ID 生成工具 - 单元测试
 */
const { describe, it, expect, runSuites } = require('./test.helper')
const { generateId, generateBillId, generateBookId, generateMemberId, generateInboxId, generateRequestId } = require('../utils/id')

describe('id.generateId 基础ID生成', () => {
  it('无前缀生成非空字符串', () => {
    const id = generateId()
    expect(id.length).toBeGreaterThan(0)
    expect(typeof id).toBe('string')
  })

  it('有前缀包含前缀', () => {
    const id = generateId('test')
    expect(id.startsWith('test_')).toBeTruthy()
  })

  it('多次生成结果不同', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })
})

describe('id 业务ID生成', () => {
  it('generateBillId 包含 bill_ 前缀', () => {
    expect(generateBillId().startsWith('bill_')).toBeTruthy()
  })

  it('generateBookId 包含 book_ 前缀', () => {
    expect(generateBookId().startsWith('book_')).toBeTruthy()
  })

  it('generateMemberId 包含 mem_ 前缀', () => {
    expect(generateMemberId().startsWith('mem_')).toBeTruthy()
  })

  it('generateInboxId 包含 inbox_ 前缀', () => {
    expect(generateInboxId().startsWith('inbox_')).toBeTruthy()
  })
})

describe('id.generateRequestId UUID格式', () => {
  it('生成符合UUID v4格式的字符串', () => {
    const id = generateRequestId()
    // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(pattern.test(id)).toBeTruthy()
  })

  it('长度为36', () => {
    expect(generateRequestId().length).toBe(36)
  })

  it('多次生成唯一', () => {
    const ids = new Set()
    for (let i = 0; i < 50; i++) {
      ids.add(generateRequestId())
    }
    expect(ids.size).toBe(50)
  })
})
