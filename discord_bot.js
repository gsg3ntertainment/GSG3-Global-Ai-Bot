import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    Collection, 
    SlashCommandBuilder,
    PermissionsBitField
} from 'discord.js';
import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';

dotenv.config();

// Initialize the Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,              // Enables bot to work in servers
    GatewayIntentBits.GuildMessages,       // Enables bot to receive messages
    GatewayIntentBits.MessageContent,      // Allows bot to read messages (Must be enabled in Developer Portal)
    GatewayIntentBits.GuildMembers         // Allows bot to fetch member info (Must be enabled in Developer Portal)
  ],
});

client.once('ready', () => {
  console.log("🤖 Discord Bot is online as ${client.user.tag}");
});

// Initialize OpenAI operations
const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

// Listen for messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const content = message.content.trim().toLowerCase();

    if (content.startsWith('!')) {
        const userMessage = content.replace('!', '').trim();
        if (!userMessage) {
            message.reply('Please provide a message after !dr.');
            return;
        }

        try {
            const response = await openaiOps.make_openai_call(userMessage);
            message.reply(response);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            message.reply('⚠️ Error processing your request.');
        }
    }
});

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';

dotenv.config();

// Initialize the Discord Client
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

// Listen for messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    if (content.startsWith('!')) {
        const userMessage = content.replace('!', '').trim();
        if (!userMessage) {
            message.reply('Please provide a message after !');
            return;
        }

        try {
            const response = await openaiOps.make_openai_call(userMessage);
            message.reply(response);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            message.reply('⚠️ Error processing your request.');
        }
    }
});

// Login function to start the bot
function startDiscordBot() {
    client.login(process.env.DISCORD_TOKEN);
}

export { startDiscordBot, client };
