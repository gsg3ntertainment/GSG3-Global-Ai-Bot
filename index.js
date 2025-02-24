import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';
import client from './discord_bot.js'; // Import Discord client

// Start keep alive cron job
job.start();
console.log(process.env);

// Setup express app
const app = express();
const expressWsInstance = expressWs(app);

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Load environment variables
const GPT_MODE = process.env.GPT_MODE;
const HISTORY_LENGTH = process.env.HISTORY_LENGTH;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;
const TWITCH_USER = process.env.TWITCH_USER;
const TWITCH_AUTH = process.env.TWITCH_AUTH;
const COMMAND_NAME = process.env.COMMAND_NAME;
const CHANNELS = process.env.CHANNELS;
const SEND_USERNAME = process.env.SEND_USERNAME;
const ENABLE_TTS = process.env.ENABLE_TTS;
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS;
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10); // Cooldown duration in seconds

if (!OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastUserMessage = '';
let lastResponseTime = 0; // Track the last response time

// Setup Twitch bot
console.log('Channels: ', channels);
const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Setup OpenAI operations
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

// Setup Twitch bot callbacks
bot.onConnected((addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
    channels.forEach(channel => {
        console.log(`* Joining ${channel}`);
        console.log(`* Saying hello in ${channel}`);
    });
});

bot.onDisconnected(reason => {
    console.log(`Disconnected: ${reason}`);
});

// Connect bot
bot.connect(
    () => {
        console.log('Bot connected!');
    },
    error => {
        console.error('Bot couldn\'t connect!', error);
    }
);

bot.onMessage(async (channel, user, message, self) => {
    if (self) return;

    const currentTime = Date.now();
    const elapsedTime = (currentTime - lastResponseTime) / 1000; // Time in seconds

    if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
        console.log(`Highlighted message: ${message}`);
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
            return;
        }
        lastResponseTime = currentTime; // Update the last response time

        const response = await openaiOps.make_openai_call(message);
        bot.say(channel, response);
    }

    const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
    if (command) {
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
            return;
        }
        lastResponseTime = currentTime; // Update the last response time

        let text = message.slice(command.length).trim();
        if (SEND_USERNAME === 'true') {
            text = `Message from user ${user.username}: ${text}`;
        }

        const response = await openaiOps.make_openai_call(text);
        if (response.length > maxLength) {
            const messages = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    bot.say(channel, msg);
                }, 1000 * index);
            });
        } else {
            bot.say(channel, response);
        }

        if (ENABLE_TTS === 'true') {
            try {
                const ttsAudioUrl = await bot.sayTTS(channel, response, user['userstate']);
                notifyFileChange(ttsAudioUrl);
            } catch (error) {
                console.error('TTS Error:', error);
            }
        }
    }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});

// Log the bot in
client.login(process.env.DISCORD_TOKEN);

export default app;
