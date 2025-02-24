import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';
import client from './discord_bot.js'; // Import Discord client

// Start keep-alive cron job
job.start();
console.log(process.env);

// Setup express app
const app = express();
expressWs(app);
app.set('view engine', 'ejs');

// Load environment variables
const {
    GPT_MODE,
    HISTORY_LENGTH,
    OPENAI_API_KEY,
    MODEL_NAME,
    TWITCH_USER,
    TWITCH_AUTH,
    COMMAND_NAME,
    CHANNELS,
    SEND_USERNAME,
    ENABLE_TTS,
    ENABLE_CHANNEL_POINTS,
    COOLDOWN_DURATION,
    DISCORD_TOKEN
} = process.env;

if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let lastResponseTime = 0; // Track the last response time

// Initialize Twitch bot
console.log('Joining channels: ', channels);
const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Initialize OpenAI operations
const fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

// Twitch bot events
bot.onConnected((addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
});

bot.onDisconnected(reason => {
    console.log(`Disconnected: ${reason}`);
});

bot.connect(() => console.log('Bot connected!'), error => console.error('Bot connection failed:', error));

bot.onMessage(async (channel, user, message, self) => {
    if (self) return;
    const currentTime = Date.now();
    const elapsedTime = (currentTime - lastResponseTime) / 1000;
    
    if (elapsedTime < COOLDOWN_DURATION) {
        bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds.`);
        return;
    }
    lastResponseTime = currentTime;

    if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
        const response = await openaiOps.make_openai_call(message);
        bot.say(channel, response);
        return;
    }
    
    const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
    if (command) {
        let text = message.slice(command.length).trim();
        if (SEND_USERNAME === 'true') {
            text = `User ${user.username} says: ${text}`;
        }
        const response = await openaiOps.make_openai_call(text);
        response.length > maxLength ? response.match(new RegExp(`.{1,${maxLength}}`, 'g')).forEach((msg, i) => 
            setTimeout(() => bot.say(channel, msg), 1000 * i)) : bot.say(channel, response);
    }
});

// Discord Bot Integration
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'votekick') {
        await interaction.reply({ content: "🗳️ Creating a kick poll...", ephemeral: true });
    } else if (interaction.commandName === 'clear') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            return interaction.reply({ content: "❌ You must mention a user!", ephemeral: true });
        }
        await interaction.reply({ content: `✅ Cleared messages from ${targetUser.username}.`, ephemeral: true });
    } else if (interaction.commandName === 'ask') {
        const question = interaction.options.getString('question');
        const aiResponse = await openaiOps.make_openai_call(question);
        await interaction.reply({ content: aiResponse, ephemeral: false });
    }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Log the Discord bot in
client.login(DISCORD_TOKEN);

export default app;
