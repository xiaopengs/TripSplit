/**
 * 轻量级测试框架
 * 支持 describe/it/expect/beforeEach/afterEach
 * 无需第三方依赖，纯 Node.js 运行
 */

const PASSED = '\x1b[32m✓\x1b[0m'
const FAILED = '\x1b[31m✗\x1b[0m'
const SUITE  = '\x1b[36m▸\x1b[0m'
const BOLD   = '\x1b[1m'

let _currentSuite = null
let _suites = []
let _stats = { total: 0, passed: 0, failed: 0, errors: [] }
let _beforeEach = null
let _afterEach = null

function describe(name, fn) {
  const parent = _currentSuite
  const suite = { name, tests: [], children: [], beforeEach: null, afterEach: null, level: parent ? parent.level + 1 : 0 }
  _suites.push(suite)
  const prevSuite = _currentSuite
  const prevBeforeEach = _beforeEach
  const prevAfterEach = _afterEach
  _currentSuite = suite
  _beforeEach = suite.beforeEach = parent ? parent.beforeEach : null
  _afterEach = suite.afterEach = parent ? parent.afterEach : null
  fn()
  _currentSuite = prevSuite
  _beforeEach = prevBeforeEach
  _afterEach = prevAfterEach
}

function it(name, fn) {
  if (!_currentSuite) throw new Error('it() must be called inside describe()')
  _currentSuite.tests.push({ name, fn, suite: _currentSuite })
  _stats.total++
}

function beforeEach(fn) {
  if (_currentSuite) _currentSuite.beforeEach = fn
}

function afterEach(fn) {
  if (_currentSuite) _currentSuite.afterEach = fn
}

// === Expect ===
function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`)
    },
    toEqual(expected) {
      const a = JSON.stringify(actual)
      const b = JSON.stringify(expected)
      if (a !== b) throw new Error(`Expected ${a} to equal ${b}`)
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`)
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`)
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected ${JSON.stringify(actual)} to be null`)
    },
    toBeDefined() {
      if (actual === undefined) throw new Error(`Expected value to be defined`)
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} to be greater than ${expected}`)
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) throw new Error(`Expected ${actual} to be less than ${expected}`)
    },
    toContain(expected) {
      if (typeof actual === 'string') {
        if (!actual.includes(expected)) throw new Error(`Expected "${actual}" to contain "${expected}"`)
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`)
      } else {
        throw new Error('toContain requires string or array')
      }
    },
    toThrow() {
      let threw = false
      try { actual() } catch (e) { threw = true }
      if (!threw) throw new Error('Expected function to throw')
    },
    toHaveLength(expected) {
      if (!Array.isArray(actual) && typeof actual !== 'string') throw new Error('toHaveLength requires array or string')
      if (actual.length !== expected) throw new Error(`Expected length ${expected} but got ${actual.length}`)
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(actual - expected)
      const threshold = Math.pow(10, -precision) / 2
      if (diff > threshold) throw new Error(`Expected ${actual} to be close to ${expected}`)
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) throw new Error(`Expected ${actual} to be >= ${expected}`)
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) throw new Error(`Expected ${actual} to be <= ${expected}`)
    },
    toMatch(pattern) {
      if (typeof pattern === 'string') {
        if (!actual.includes(pattern)) throw new Error(`Expected "${actual}" to match pattern "${pattern}"`)
      } else if (pattern instanceof RegExp) {
        if (!pattern.test(actual)) throw new Error(`Expected "${actual}" to match ${pattern}`)
      }
    },
    not: {
      toBe(expected) {
        if (actual === expected) throw new Error(`Expected ${JSON.stringify(actual)} not to be ${JSON.stringify(expected)}`)
      },
      toBeNull() {
        if (actual === null) throw new Error(`Expected value not to be null`)
      },
      toBeTruthy() {
        if (actual) throw new Error(`Expected ${JSON.stringify(actual)} not to be truthy`)
      }
    }
  }
}

// === Runner ===
async function runSuites() {
  const startTime = Date.now()
  console.log(`\n${BOLD}🧪 TripSplit 测试套件${BOLD}\n${'─'.repeat(50)}`)

  for (const suite of _suites) {
    await runSuite(suite)
  }

  const elapsed = Date.now() - startTime
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`${BOLD}结果: ${_stats.passed}/${_stats.total} 通过${BOLD} (${elapsed}ms)`)
  if (_stats.failed > 0) {
    console.log(`\n${FAILED} ${_stats.failed} 个失败:\n`)
    _stats.errors.forEach(e => console.log(`  ${e}\n`))
    process.exit(1)
  } else {
    console.log(`${PASSED} 全部通过！`)
  }
}

async function runSuite(suite, parentBeforeEach = null, parentAfterEach = null) {
  const indent = '  '.repeat(suite.level)
  console.log(`${indent}${SUITE} ${suite.name}`)

  const beFn = suite.beforeEach || parentBeforeEach
  const aeFn = suite.afterEach || parentAfterEach

  for (const test of suite.tests) {
    try {
      if (beFn) beFn()
      await test.fn()
      if (aeFn) aeFn()
      console.log(`${indent}  ${PASSED} ${test.name}`)
      _stats.passed++
    } catch (err) {
      console.log(`${indent}  ${FAILED} ${test.name}`)
      console.log(`${indent}    ${FAILED} ${err.message}`)
      _stats.failed++
      _stats.errors.push(`${suite.name} > ${test.name}: ${err.message}`)
    }
  }
}

module.exports = { describe, it, expect, beforeEach, afterEach, runSuites }
