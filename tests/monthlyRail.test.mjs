import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real rail's DOM-effect boundary without a browser dependency.
// The harness supplies hook storage and a scroll target; JSX is not inspected.
const source = readFileSync(new URL('../src/AppV3.tsx', import.meta.url), 'utf8')
const tree = ts.createSourceFile('AppV3.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const rail = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'MonthlyRail')
const code = ts.transpileModule(rail.getText(tree), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText

test('rail reveals the selected month again when preceding months are added', () => {
  let previousDependencies
  let pendingEffect
  let selectedOffset = 260
  const scrolls = []
  const context = vm.createContext({
    React: { createElement: () => null },
    monthLabel: (key) => key,
    money: String,
    useRef: () => ({ current: {
      querySelector: () => ({ offsetLeft: selectedOffset }),
      scrollTo: (options) => scrolls.push(options.left),
    } }),
    useEffect: (effect, dependencies) => {
      if (!previousDependencies || dependencies.some((value, i) => value !== previousDependencies[i])) pendingEffect = effect
      previousDependencies = dependencies
    },
  })
  vm.runInContext(code, context)
  const render = (keys) => {
    context.MonthlyRail({ rows: keys.map((key) => ({ key, income: 0, expense: 0, net: 0, balance: 0 })), selectedKey: '2026-09', onSelect() {} })
    pendingEffect?.()
    pendingEffect = undefined
  }
  render(['2026-08', '2026-09'])
  selectedOffset = 1040
  render(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  assert.deepEqual(scrolls, [260, 1040])
  // Value-only rerenders do not pull the user back while they browse the rail.
  render(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  assert.deepEqual(scrolls, [260, 1040])
})
