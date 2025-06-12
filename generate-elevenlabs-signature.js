require('dotenv').config()
const crypto = require('crypto')
const fs = require('fs')

if (!process.env.ELEVENLABS_WEBHOOK_SECRET) {
  console.error('Please set ELEVENLABS_WEBHOOK_SECRET in your environment or .env file.')
  process.exit(1)
}

if (process.argv.length < 3) {
  console.error('Usage: node generate-elevenlabs-signature.js <payload.json>')
  process.exit(1)
}

const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
const payloadPath = process.argv[2]

let body
try {
  body = fs.readFileSync(payloadPath, 'utf8') // Do NOT trim; preserve all bytes
  // Normalize line endings to LF for signature generation
  body = body.replace(/\r\n/g, '\n')
  JSON.parse(body) // Validate JSON, but do not minify or re-stringify
} catch (err) {
  console.error('Failed to read or parse payload file:', err.message)
  process.exit(1)
}

const timestamp = Math.floor(Date.now() / 1000)
const message = `${timestamp}.${body}`
const signature = crypto.createHmac('sha256', secret).update(message).digest('hex')

console.log(`elevenlabs-signature: t=${timestamp},v0=${signature}`)
