import _ from 'lodash'
import fs from 'fs-extra'
import StreamBuffers from 'stream-buffers'
import streamToPromise from 'stream-to-promise'
import RJSON from 'relaxed-json'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'
import GIFEncoder from 'gifencoder'

async function run() {
  const bytesPerFrame = 1000
  const buffer = JSON.stringify(RJSON.parse((await fs.readFile('./test.json')).toString()))
  const chunks = _.chunk(buffer, bytesPerFrame).map(a => Buffer.from(a.join('')).toString())
  let i = 0
  const codes = await Bluebird.map(chunks, async (c) => {
    // add in a header and pad everything.
    const header = Buffer.from([
      0x02, 0x26, // Magic
      0x00, // Chunk #
      0x00, // Total 
      0x00, 0x00, // Length
    ])     
    header.writeUInt8(i++, 2)
    header.writeUInt8(chunks.length, 3)
    header.writeUInt16BE(c.length, 4)
    const padding = Buffer.alloc(bytesPerFrame - c.length, 0).toString()
    const data = header.toString().concat(c, padding)
    return toQRCode(data)
  })
  
  i = 0
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