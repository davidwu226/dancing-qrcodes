require('source-map-support')

import _ from 'lodash'
import Bluebird from 'bluebird'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import GIFEncoder from 'gifencoder'
import { GifReader } from 'omggif'
import jsQR from 'jsqr'
import pako from 'pako'

/**
 * Convert data to a dancing QR code (animated GIF).
 * 
 * @param data - Data to convert.
 * @param opts - Options for conversion.
 */
export async function encode(data: string|Buffer, { bytesPerFrame = 400, delayPerFrame = 500 } = {}): Promise<{ gif: Buffer, frameCount: number}> {
  // Split string up in to frames.
  const buf = _.isString(data) ? Buffer.from(data) : data
  const compress = pako.deflate(buf)
  const chunks = _.chunk(compress, bytesPerFrame).map(a => Buffer.from(a))

  const colors = [
    '#00aa11ff',
    '#00bb11ff',
    '#00cc11ff',
    '#00dd11ff',
    '#00ee11ff',
    '#00dd11ff',
    '#00cc11ff',
    '#00bb11ff',
  ]

  // Generate a QR image per frame.
  let frameCount = 0
  let width = 0
  let height = 0

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
    const data = Buffer.concat([header, c, padding])
    let x: any = [{ data: data.toString('binary'), mode: 'byte' }]
    const png = PNG.sync.read(await (<any>QRCode).toBuffer(x))
    if (png.width > width) {
      width = png.width
    }
    if (png.height > height) {
      height = png.height
    }
    return png
  })

  // Encode in to an animated GIF.
  const encoder = new GIFEncoder(width, height)
  encoder.start()
  encoder.setRepeat(0) // Loop infinitely.
  encoder.setDelay(delayPerFrame)

  for (let i = 0; i < pngs.length; ++i) {
    const png = pngs[i]
    const dst = new PNG({ width, height })
    PNG.bitblt(png, dst, 0, 0, png.width, png.height, (width - png.width) / 2, (height - png.height) / 2)
    encoder.addFrame(dst.data)
  }

  // Profit.
  encoder.finish()
  return { gif: encoder.out.getData(), frameCount }
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
  return Buffer.from(pako.inflate(res))
}
