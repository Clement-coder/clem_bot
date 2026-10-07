require('dotenv').config()
const { Telegraf } = require('telegraf')
const Groq = require('groq-sdk')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const conversations = {}

const SYSTEM_PROMPT = `You are WallexNexus, an intelligent AI assistant built by Patrick Walshak, a Full-Stack Software Engineer and AI Automation Engineer from Nigeria.

Your personality:
- You are helpful, friendly and slightly futuristic
- You keep responses concise and clear
- You are knowledgeable about technology, coding and AI
- You respond naturally like a real assistant

Rules:
- Keep responses under 200 words
- Be conversational and helpful
- If asked who built you say Patrick Walshak built you`

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
    model: 'qwen/qwen3.8-27b',
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

async function generateImage(prompt) {
  const encodedPrompt = encodeURIComponent(prompt)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`
  return imageUrl
}

bot.start((ctx) => {
  const firstName = ctx.from.first_name
  ctx.reply(`Hello ${firstName}! 👋\n\nI am WallexNexus, your AI assistant built by Patrick Walshak.\n\nWhat I can do:\n🤖 Answer any question — just type it\n🎨 Generate images — /image a sunset over Lagos\n🗑 Clear history — /clear\n❓ Get help — /help\n\nLet us get started!`)
})

bot.help((ctx) => {
  ctx.reply(`Commands:\n\n/start - Start a conversation\n/help - Show this message\n/clear - Clear conversation history\n/image [description] - Generate an AI image\n\nExample:\n/image a futuristic robot in Lagos\n\nOr just type any message for AI chat!`)
})

bot.command('clear', (ctx) => {
  const userId = ctx.from.id
  conversations[userId] = []
  ctx.reply('Conversation cleared. Starting fresh!')
})

bot.on('text', async (ctx) => {
  const userId = ctx.from.id
  const text = ctx.message.text

  try {
    await ctx.sendChatAction('typing')
    const response = await askAI(userId, text)
    await ctx.reply(response)
  } catch (error) {
    console.error('Error:', error)
    await ctx.reply('Sorry I encountered an error. Please try again.')
  }
})

bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.replace('/image', '').trim()

  if (!prompt) {
    return ctx.reply('Please provide a description. Example:\n/image a futuristic city in Nigeria at night')
  }

  try {
    await ctx.sendChatAction('upload_photo')
    ctx.reply('Generating your image... Please wait a moment.')

    const imageUrl = await generateImage(prompt)

    await ctx.replyWithPhoto(imageUrl, {
      caption: `🎨 Generated: ${prompt}`
    })

  } catch (error) {
    console.error('Image error:', error)
    ctx.reply('Sorry I could not generate that image. Please try again.')
  }
})

bot.launch()
console.log('WallexNexus Bot is running...')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))