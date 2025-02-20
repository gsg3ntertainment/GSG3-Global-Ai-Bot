import tmi from 'tmi.js';
import OpenAI from 'openai';
import mysql from 'mysql2/promise';
const dotenv = import('dotenv');

// Load environment variables
dotenv.config();

export default class TwitchBot  {
    constructor(username, password, channels, openai_api_key, enable_tts) {
        this.client = new tmi.Client({
            options: { debug: true },
            connection: {
                secure: true,
                reconnect: true
            },
            identity: { username, password },
            channels
        });

        this.openai = new OpenAI({ apiKey: openai_api_key });
        this.enable_tts = enable_tts;
        this.initDatabase();
    }

    async initDatabase() {
        this.db = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                points INT DEFAULT 0
            );
        `);
    }

    async connect() {
        await this.client.connect();
        console.log('Twitch Bot Connected');
    }

    async handleMessage(channel, userstate, message, self) {
        if (self) return;
        const username = userstate.username.toLowerCase();
        console.log(`${username}: ${message}`);

        if (message.startsWith('!points')) {
            await this.getPoints(channel, username);
        } else if (message.startsWith('!addpoints')) {
            const parts = message.split(' ');
            if (parts.length === 3) {
                const targetUser = parts[1].replace('@', '').toLowerCase();
                const points = parseInt(parts[2]);
                if (!isNaN(points)) await this.addPoints(channel, targetUser, points);
            }
        } else if (message.startsWith('!ask')) {
            const query = message.replace('!ask', '').trim();
            if (query) await this.getAIResponse(channel, username, query);
        }
    }

    async getPoints(channel, username) {
        const [rows] = await this.db.query('SELECT points FROM users WHERE username = ?', [username]);
        const points = rows.length ? rows[0].points : 0;
        this.client.say(channel, `@${username}, you have ${points} points.`);
    }

    async addPoints(channel, username, amount) {
        await this.db.query(
            'INSERT INTO users (username, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE points = points + ?',
            [username, amount, amount]
        );
        this.client.say(channel, `@${username}, you have been awarded ${amount} points!`);
    }

    async getAIResponse(channel, username, query) {
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: query }]
            });
            const reply = response.choices[0].message.content;
            this.client.say(channel, `@${username}, ${reply}`);
        } catch (error) {
            console.error('Error fetching OpenAI response:', error);
        }
    }

    onMessage() {
        this.client.on('message', (channel, userstate, message, self) => {
            this.handleMessage(channel, userstate, message, self);
        });
    }
}

// Instantiate the bot
const bot = new TwitchBot(
    process.env.TWITCH_USER,
    `oauth:${process.env.TWITCH_AUTH}`,
    process.env.CHANNELS.split(','),
    process.env.OPENAI_API_KEY,
    process.env.ENABLE_TTS === 'true'
);

bot.connect();
bot.onMessage();
