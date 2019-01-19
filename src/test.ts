import _ from 'lodash'
import fs from 'fs-extra'
import RJSON from 'relaxed-json'
import { encode, decode } from './'

let original

async function test_generate() {
  const data = JSON.stringify(RJSON.parse((await fs.readFile('./test4')).toString()))
  original = data
  const { gif, frameCount } = await encode(data, { bytesPerFrame: 500, delayPerFrame: 200 })
  await fs.writeFile('qr.gif', gif)
  console.log(`${frameCount} frames generated.`)
}

async function test_binary() {
  const data = await fs.readFile('./test4.bz2')
  original = data
  const { gif, frameCount } = await encode(data, { bytesPerFrame: 500, delayPerFrame: 200 })
  await fs.writeFile('qr.gif', gif)
  console.log(`${frameCount} frames generated.`)
}

async function test_read() {
  const file = await fs.readFile('./qr.gif')
  return decode(file)
}

async function run() {
  console.log('running')
  await test_generate()
  const res = await test_read()
  if (res.toString('binary') !== original) {
    console.log('different!')
  } else {
    console.log('same!')
  }
}

run()
