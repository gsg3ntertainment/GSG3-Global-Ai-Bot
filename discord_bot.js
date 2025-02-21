import { 
    Client, 
    GatewayIntentBits, 
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

const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,              
        GatewayIntentBits.GuildMessages,       
        GatewayIntentBits.MessageContent,      
        GatewayIntentBits.GuildMembers         
    ],
});

bot.once('ready', () => {
    console.log(`🤖 Discord Bot is online as ${bot.user.tag}`);
});

// Initialize OpenAI operations
const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

// Store active polls
const activePolls = new Collection();

// 🆕 AI Support for "support" Channel
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const ownerRoleId = process.env.OWNER_ROLE_ID;
const managerRoleId = process.env.MANAGER_ROLE_ID;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const acknowledgedUsers = new Set();

bot.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== supportChannelId) return;

    console.log(`💬 Support message detected from ${message.author.username}: ${message.content}`);

    // Determine which role to mention based on message content
    let roleToMention = null;
    if (message.content.toLowerCase().includes("digitaltrove.net")) {
        roleToMention = `<@&${ownerRoleId}> or <@&${managerRoleId}>`;
    } else if (message.content.toLowerCase().includes("discord") || message.content.toLowerCase().includes("game")) {
        roleToMention = `<@&${adminRoleId}>`;
    }

    // First-time acknowledgment in the support channel
    if (!acknowledgedUsers.has(message.author.id)) {
        acknowledgedUsers.add(message.author.id);
        await message.reply(`👋 Hi ${message.author.username}, a staff member will assist you shortly.`);
    }

    // Generate AI response
    const aiResponse = await openaiOps.askAI(message.content);
    let privateReply = `🤖 **AI Response:**\n${aiResponse}`;

    try {
        // Send private response via DM
        await message.author.send(privateReply);
        console.log(`✅ Sent private AI response to ${message.author.username}`);

        // Notify the support channel (without AI response)
        if (roleToMention) {
            await message.channel.send(`🔔 ${message.author.username} is receiving private support. Notifying: ${roleToMention}`);
        }
    } catch (error) {
        console.error(`❌ Could not DM ${message.author.username}:`, error);
        await message.reply("⚠️ I couldn't send you a private message. Please check your DM settings.");
    }
});

// Slash Command: /mappoll
bot.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'mappoll') {
        await interaction.reply({ content: "🗳️ Creating a map poll...", ephemeral: true });

        const channel = interaction.channel;
        if (!channel) {
            return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });
        }

        sendPoll(channel);
    }
});

// Function to send a poll
async function sendPoll(channel) {
    const pollQuestion = "📢 **Vote for the next map!**";
    const options = ["Dust2", "Anubis", "Nuke", "Mirage", "Inferno", "Ancient", "Train"];

    const buttons = options.map((option, index) => 
        new ButtonBuilder()
            .setCustomId(`poll_${index}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary)
    );

    const row1 = new ActionRowBuilder().addComponents(buttons.slice(0, 5)); 
    const row2 = new ActionRowBuilder().addComponents(buttons.slice(5)); 
    const components = buttons.length > 5 ? [row1, row2] : [row1];

    const pollMessage = await channel.send({ content: pollQuestion, components });
    console.log("✅ Poll sent successfully!");

    // Store poll data
    activePolls.set(pollMessage.id, { votes: new Collection(), options });

    // Close the poll after 1 minute
    setTimeout(async () => {
        await endPoll(pollMessage);
    }, 60000);
}

// Register Slash Commands
bot.on('ready', async () => {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
        console.error("❌ GUILD_ID is missing in environment variables.");
        return;
    }

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
        console.error("❌ Guild not found!");
        return;
    }

    try {
        await guild.commands.create(
            new SlashCommandBuilder()
                .setName('mappoll')
                .setDescription('Creates a map vote poll with buttons.')
        );

        console.log("✅ Slash command `/mappoll` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
    }
});
export const bot = bot;

// Login the bot
bot.login(process.env.DISCORD_TOKEN);
