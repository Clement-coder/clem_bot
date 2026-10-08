require('dotenv').config()
const { Telegraf } = require('telegraf')
const Groq = require('groq-sdk')
const https = require('https')
const http = require('http')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const conversations = {}

const SYSTEM_PROMPT = `You are WallexNexus, an intelligent AI assistant built by Clement, a Full-Stack Software Engineer and AI Automation Engineer from Nigeria.

Your personality:
- You are helpful, friendly and slightly futuristic
- You keep responses concise and clear
- You are knowledgeable about technology, coding and AI
- You respond naturally like a real assistant

Rules:
- Keep responses under 200 words
- Be conversational and helpful
- If asked who built you say Clement built you
- You CAN generate images using the /image command
- Never say you cannot generate images`

async function askAI(userId, userMessage) {
  if (!conversations[userId]) {
    conversations[userId] = []
  }

  conversations[userId].push({
    role: 'user',
    content: userMessage
  })

  if (conversations[userId].length > 10) {
    conversations[userId] = conversations[userId].slice(-10)
  }

  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    temperature: 0.7,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversations[userId]
    ]
  })

  const aiMessage = response.choices[0].message.content

  conversations[userId].push({
    role: 'assistant',
    content: aiMessage
  })

  return aiMessage
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image. Status: ${response.statusCode}`))
        return
      }

      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Image download timed out'))
    })
  })
}

bot.start((ctx) => {
  const firstName = ctx.from.first_name
  ctx.reply(
    `Hello ${firstName}! 👋\n\nI am WallexNexus, your AI assistant built by Clement.\n\nWhat I can do:\n🤖 Answer any question — just type it\n🎨 Generate images — /image a sunset over Lagos\n🗑 Clear history — /clear\n❓ Get help — /help\n\nLet us get started!`
  )
})

bot.help((ctx) => {
  ctx.reply(
    `Commands:\n\n/start - Start a conversation\n/help - Show this message\n/clear - Clear conversation history\n/image [description] - Generate an AI image\n\nExample:\n/image a futuristic robot in Lagos\n\nOr just type any message for AI chat!`
  )
})

bot.command('clear', (ctx) => {
  const userId = ctx.from.id
  conversations[userId] = []
  ctx.reply('Conversation cleared. Starting fresh!')
})

bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.replace('/image', '').trim()

  if (!prompt) {
    return ctx.reply('Please provide a description.\n\nExample:\n/image a futuristic city in Nigeria at night')
  }

  try {
    await ctx.sendChatAction('upload_photo')
    await ctx.reply('⏳ Generating your image... Please wait about 20 seconds.')

    console.log('Generating image for prompt:', prompt)

    const fetch = (await import('node-fetch')).default

    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: prompt }),
        timeout: 60000
      }
    )

    console.log('HuggingFace response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('HuggingFace error:', errorText)
      throw new Error(`Image generation failed: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    console.log('Image size:', imageBuffer.length, 'bytes')

    await ctx.replyWithPhoto(
      { source: imageBuffer },
      { caption: `🎨 ${prompt}` }
    )

  } catch (error) {
    console.error('Image error:', error.message)
    await ctx.reply('Sorry I could not generate that image. Please try again in a moment.')
  }
})

bot.on('text', async (ctx) => {
  const userId = ctx.from.id
  const text = ctx.message.text

  if (text.startsWith('/')) return

  try {
    await ctx.sendChatAction('typing')
    const response = await askAI(userId, text)
    await ctx.reply(response)
  } catch (error) {
    console.error('Chat error:', error)
    await ctx.reply('Sorry I encountered an error. Please try again.')
  }
})

async function startBot() {
  try {
    await bot.launch()
    console.log('WallexNexus Bot is running...')
  } catch (error) {
    console.error('Failed to start, retrying in 5 seconds...', error.message)
    setTimeout(startBot, 5000)
  }
}

startBot()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
