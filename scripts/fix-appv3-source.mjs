import fs from 'node:fs'

const path = 'src/AppV3.tsx'
let source = fs.readFileSync(path, 'utf8')
const broken = "join(',')})}}><span>{money(expenseTotal)}</span>"
const fixed = "join(',')})`}}><span>{money(expenseTotal)}</span>"
if (source.includes(broken)) {
  source = source.replace(broken, fixed)
  fs.writeFileSync(path, source)
  console.log('AppV3 JSX corrigido.')
} else {
  console.log('Nenhuma correção necessária.')
}
