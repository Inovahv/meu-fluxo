import fs from 'node:fs'
const path='src/AppV3.tsx'
let source=fs.readFileSync(path,'utf8')
source=source.replaceAll("'./financeCore.mjs'", "'./financeCore'")
fs.writeFileSync(path,source)
