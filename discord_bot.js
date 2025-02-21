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

// Store active polls
const activePolls = new Collection();

// 🆕 AI Support for "support" Channel
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const ownerRoleId = process.env.OWNER_ROLE_ID;
const managerRoleId = process.env.MANAGER_ROLE_ID;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const acknowledgedUsers = new Set();

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

// Slash Command: /mappoll
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'mappoll') {
        await interaction.reply({ content: "🗳️ Creating a map poll...", ephemeral: true });

        const channel = interaction.channel;
        if (!channel) {
            return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });
    if (interaction.isCommand()) {
        if (interaction.commandName === 'mappoll') {
            await interaction.reply({ content: "🗳️ Creating a map poll...", ephemeral: true });
            const channel = interaction.channel;
            if (!channel) {
                return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });
            }
            sendPoll(channel);
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

// Slash Command: /clear <user>
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() || interaction.commandName !== 'clear') return;

    const targetUser = interaction.options.getUser('user');
    if (!targetUser) {
        return interaction.reply({ content: "❌ You must mention a user!", ephemeral: true });
    }

    const channel = interaction.channel;
    if (!channel) {
        return interaction.reply({ content: "❌ Could not access the channel.", ephemeral: true });
        return;
    }

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const userMessages = messages
            .filter(msg => msg.author.id === targetUser.id)
            .first(50);
    if (interaction.isButton()) {
        if (!interaction.customId.startsWith('poll_')) return;

        if (userMessages.length === 0) {
            return interaction.reply({ content: `⚠️ No messages found from ${targetUser.username}.`, ephemeral: true });
        const pollData = activePolls.get(interaction.message.id);
        if (!pollData) {
            return interaction.reply({ content: "❌ This poll is no longer active.", ephemeral: true });
        }

        await channel.bulkDelete(userMessages, true);
        await interaction.reply({ content: `✅ Deleted ${userMessages.length} messages from ${targetUser.username}.` });
    } catch (error) {
        console.error("Clear command error:", error);
        await interaction.reply({ content: "❌ Error deleting messages.", ephemeral: true });
    }
});

// Register Slash Commands
client.on('ready', async () => {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
        console.error("❌ GUILD_ID is missing in environment variables.");
        return;
    }
        const voteIndex = parseInt(interaction.customId.replace('poll_', ''), 10);
        const selectedOption = pollData.options[voteIndex];

    const guild = client.guilds.cache.get(guildId);
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
        if (!selectedOption) {
            return interaction.reply({ content: "❌ Invalid vote option.", ephemeral: true });
        }

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
        // Track user votes
        pollData.votes.set(interaction.user.id, selectedOption);

        console.log("✅ Slash commands `/mappoll` and `/clear` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
        await interaction.reply({ content: `✅ You voted for **${selectedOption}**!`, ephemeral: true });
    }
});

// Login the bot
client.login(process.env.DISCORD_TOKEN);
