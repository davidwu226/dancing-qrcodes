import QRCode from 'qrcode'

async function run() {
  const res = QRCode.toString('hello')
  console.log(res)
}


run()