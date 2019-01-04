import _ from 'lodash'
import StreamBuffers from 'stream-buffers'
import streamToPromise from 'stream-to-promise'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import GIFEncoder from 'gifencoder'
import { GifReader } from 'omggif'
import jsQR from 'jsqr'

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
    const padding = Buffer.alloc(bytesPerFrame - c.length, 0)
    const data = Buffer.concat([header, Buffer.from(c), padding])
    let x: any = [{ data: data.toString('binary'), mode: 'byte' }]
    return toQRCode(x, { color: { dark: '#000000ff', light: '#ffffffff' }})
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

/**
 * Convert dancing QR code (animated GIF) to data.
 *
 * @param image - Animated GIF to convert.
 */
export async function decode(image: Buffer) {
  const gif = new GifReader(image)

  let frames = []
  let totalFrames = undefined

  for (let i = 0; i < gif.numFrames(); ++i) {
    const { width, height } = gif.frameInfo(i)
    const buffer = new Array(width * height * 4)
    gif.decodeAndBlitFrameRGBA(i, buffer)
    const code = jsQR(new Uint8ClampedArray(buffer), width, height)
    const data = Buffer.from(code.data, 'binary')
    const magic = data.readUInt16BE(0)
    if (magic != 0x0226) {
      // Bad frame.
      continue
    }
    const chunk = data.readUInt8(2)
    const total = data.readUInt8(3)
    const length = data.readUInt16BE(4)

    if (totalFrames === undefined) {
      totalFrames = total
    } else if (totalFrames !== total) {
      throw new Error('Inconsistent totalFrames')
    }

    if (length > data.length - 6) {
      throw new Error('Data length too large')
    }

    frames[chunk] = data.slice(6, 6 + length)
  }

  for (let i = 0; i < totalFrames; ++i) {
    if (frames[i] === undefined) {
      throw new Error('Missing frame')
    }
  }

  const res = Buffer.concat(frames)
  return res
}
