import _ from 'lodash'
import StreamBuffers from 'stream-buffers'
import streamToPromise from 'stream-to-promise'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import GIFEncoder from 'gifencoder'

/**
 * Convert data to a dancing QR code (animated GIF).
 * 
 * @param data - Data to convert.
 * @param opts - Options for conversion.
 */
export async function encode(data: string, { bytesPerFrame = 400, delayPerFrame = 500 } = {}): Promise<{ gif: Buffer, frameCount: number}> {
  // Split string up in to frames.
  const chunks = _.chunk(data, bytesPerFrame).map(a => Buffer.from(a.join('')).toString())

  // Generate a QR image per frame.
  let frameCount = 0
  const pngs = await Bluebird.map(chunks, async (c) => {
    // add in a header and pad everything.
    const header = Buffer.from([
      0x02, 0x26, // Magic
      0x00, // Chunk #
      0x00, // Total 
      0x00, 0x00, // Length
    ])
    header.writeUInt8(frameCount++, 2)
    header.writeUInt8(chunks.length, 3)
    header.writeUInt16BE(c.length, 4)
    const padding = Buffer.alloc(bytesPerFrame - c.length, 0).toString()
    const data = header.toString().concat(c, padding)
    return toQRCode(data, { color: { dark: '#000000ff', light: '#ffffffff' }})
  })

  // Encode in to an animated GIF.
  let encoder
  for (let i = 0; i < pngs.length; ++i) {
    const png = PNG.sync.read(pngs[i])
    if (!encoder) {
      encoder = new GIFEncoder(png.width, png.height)
      encoder.start()
      encoder.setRepeat(0) // Loop infinitely.
      encoder.setDelay(delayPerFrame)
    }
    encoder.addFrame(png.data)
  }

  // Profit.
  encoder.finish()
  return { gif: encoder.out.getData(), frameCount }
}

// Convert data to PNG QR code.
async function toQRCode(data: string, opts?: any): Promise<Buffer> {
  const stream = new StreamBuffers.WritableStreamBuffer()
  QRCode.toFileStream(stream, data, opts)
  await streamToPromise(stream)
  return stream.getContents()
}
