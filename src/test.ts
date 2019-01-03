import _ from 'lodash'
import fs from 'fs-extra'
import StreamBuffers from 'stream-buffers'
import streamToPromise from 'stream-to-promise'
import RJSON from 'relaxed-json'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'

async function run() {
  const buffer = JSON.stringify(RJSON.parse((await fs.readFile('./test.json')).toString()))
  const chunks = _.chunk(buffer, 500).map(a => Buffer.from(a.join('')).toString())
  console.log(chunks)
  const codes = await Bluebird.map(chunks, async (c) => toQRCode(c))
  let i = 0
  codes.forEach(async c => {
    await fs.writeFile(`file${i++}.png`, c)
    console.log(c)
  })
}

async function toQRCode(data) {
  const stream = new StreamBuffers.WritableStreamBuffer()
  QRCode.toFileStream(stream, data)
  await streamToPromise(stream)
  return stream.getContents()
}

run()