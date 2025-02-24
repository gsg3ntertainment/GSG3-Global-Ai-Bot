import { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Collection, 
    SlashCommandBuilder 
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

client.once('ready', () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);
});

// Support message handling
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== supportChannelId) return;

    console.log(`💬 Support message detected from ${message.author.username}: ${message.content}`);

    // Determine topic-based role mention
    let roleToMention = null;
    if (message.content.toLowerCase().includes("digitaltrove.net")) {
        roleToMention = `<@&${ownerRoleId}> or <@&${managerRoleId}>`;
    } else if (message.content.toLowerCase().includes("discord") || message.content.toLowerCase().includes("game")) {
        roleToMention = `<@&${adminRoleId}>`;
    }

    // First message acknowledgment
    if (!acknowledgedUsers.has(message.author.id)) {
        acknowledgedUsers.add(message.author.id);
        await message.reply(`👋 Hi ${message.author.username}, a staff member will assist you shortly.`);
    }

    // Generate AI response
    const aiResponse = await openaiOps.askAI(message.content);
    let reply = `${aiResponse}`;

    // Append role mention if necessary
    if (roleToMention) {
        reply += `\n\n🔔 Notifying: ${roleToMention}`;
    }

    await message.channel.send(reply);
});

// Slash Command: /votekick
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'votekick') {
        await interaction.reply({ content: "🗳️ Creating a kick poll...", ephemeral: true });
        const channel = interaction.channel;
        if (!channel) {
            return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });
        }
        await sendPoll(channel);
    } else if (interaction.commandName === 'clear') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            return interaction.reply({ content: "❌ You must mention a user!", ephemeral: true });
        }
        await clearUserMessages(interaction.channel, targetUser);
        await interaction.reply({ content: `✅ Cleared messages from ${targetUser.username}.`, ephemeral: true });
    } else if (interaction.commandName === 'ask') {
        const userQuestion = interaction.options.getString('question');
        const aiResponse = await openaiOps.askAI(userQuestion);
        await interaction.reply({ content: aiResponse, ephemeral: false });
    }
});

// Function to send a poll
async function sendPoll(channel) {
    const pollQuestion = "📢 **Vote to ban the accused!**";
    const options = ["Yes", "No"];

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

// Function to clear messages from a user
async function clearUserMessages(channel, user) {
    const fetched = await channel.messages.fetch({ limit: 100 });
    const userMessages = fetched.filter(msg => msg.author.id === user.id);
    await channel.bulkDelete(userMessages);
}

// Register Slash Commands
client.on('ready', async () => {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
        console.error("❌ GUILD_ID is missing in environment variables.");
        return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        console.error("❌ Guild not found!");
        return;
    }

    try {
        await guild.commands.create(
            new SlashCommandBuilder()
                .setName('votekick')
                .setDescription('Creates a vote kick poll with buttons.')
        );

        await guild.commands.create(
            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clears the last 50 messages from a specified user in this channel.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose messages you want to clear')
                        .setRequired(true)
                )
        );

        await guild.commands.create(
            new SlashCommandBuilder()
                .setName('ask')
                .setDescription('Ask a question to the AI.')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('Your question for the AI')
                        .setRequired(true)
                )
        );

        console.log("✅ Slash commands `/votekick`, `/clear`, and `/ask` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
    }
});

// Login the bot
client.login(process.env.DISCORD_TOKEN);

export default client;
