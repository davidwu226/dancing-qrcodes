import _ from 'lodash'
import fs from 'fs-extra'
import StreamBuffers from 'stream-buffers'
import streamToPromise from 'stream-to-promise'
import RJSON from 'relaxed-json'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import GIFEncoder from 'gifencoder'
import { encode } from './'

async function run() {
  console.log('running')
  const data = JSON.stringify(RJSON.parse((await fs.readFile('./test.json')).toString()))
  const { gif, frameCount } = await encode(data, { bytesPerFrame: 400, delayPerFrame: 200 })
  await fs.writeFile('qr.gif', gif)
  console.log(`${frameCount} frames generated.`)
}

run()