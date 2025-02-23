import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    Collection
} from 'discord.js';

import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
});

client.once('ready', () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);
});

// Initialize OpenAI operations
const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

// Support System
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const acknowledgedUsers = new Set();

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== supportChannelId) return;

    console.log(`💬 Support message from ${message.author.username}: ${message.content}`);

    if (!acknowledgedUsers.has(message.author.id)) {
        acknowledgedUsers.add(message.author.id);
        await message.reply(`👋 Hi ${message.author.username}, a staff member will assist you shortly.`);
    }

    const aiResponse = await openaiOps.askAI(message.content);
    await message.channel.send(aiResponse);
});

// Command: !dr
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!dr')) return;

    const query = message.content.slice(4).trim();
    if (!query) {
        return message.reply('❌ Please provide a query. Example: `!dr How do I deploy a bot?`');
    }

    try {
        const aiResponse = await openaiOps.askAI(query);
        await message.reply(aiResponse);
    } catch (error) {
        console.error("AI API Error:", error);
        await message.reply('❌ Sorry, an error occurred while processing your request.');
    }
});

// Login the bot
client.login(process.env.DISCORD_TOKEN);
