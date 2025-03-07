import { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    Collection 
} from 'discord.js';
import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';
import { SlashCommandBuilder } from 'discord.js';

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

// Load Environment Variables
const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
const ownerRoleId = process.env.OWNER_ROLE_ID;
const managerRoleId = process.env.MANAGER_ROLE_ID;
const adminRoleId = process.env.ADMIN_ROLE_ID;
const guildId = process.env.GUILD_ID;
const acknowledgedUsers = new Set();

// Initialize OpenAI operations
const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

// Store active polls and votes
const activePolls = new Collection();

// 📩 Message Event Listener
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim().toLowerCase();

    // 🔹 OpenAI Chat Response
    if (content.startsWith('!')) {
        const userMessage = content.replace('!', '').trim();
        if (!userMessage) {
            return message.reply('Please provide a message after `!`.');
        }

        try {
            const response = await openaiOps.make_openai_call(userMessage);
            await message.reply(response);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            await message.reply('⚠️ Error processing your request.');
        }
    }

    // 🔹 AI Support for "support" Channel
    if (message.channel.id === supportChannelId) {
        console.log(`💬 Support message detected from ${message.author.username}: ${message.content}`);

        let roleToMention = null;
        if (message.content.includes("digitaltrove.net")) {
            roleToMention = `<@&${ownerRoleId}> or <@&${managerRoleId}>`;
        } else if (message.content.includes("discord") || message.content.includes("game")) {
            roleToMention = `<@&${adminRoleId}>`;
        }

        if (!acknowledgedUsers.has(message.author.id)) {
            acknowledgedUsers.add(message.author.id);
            await message.reply(`👋 Hi ${message.author.username}, a staff member will assist you shortly.`);
        }

        try {
            const aiResponse = await openaiOps.askAI(message.content);
            let reply = `${aiResponse}`;
            if (roleToMention) reply += `\n\n🔔 Notifying: ${roleToMention}`;
            await message.channel.send(reply);
        } catch (error) {
            console.error("AI Support Error:", error);
        }
    }
});

// 🗳️ Slash Command: /votekick
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'votekick') {
        await interaction.reply({ content: "🗳️ Creating a kick poll...", ephemeral: true });

        const channel = interaction.channel;
        if (!channel) return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });

        sendPoll(channel);
    }

    if (interaction.commandName === 'clear') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            return interaction.reply({ content: "❌ You must mention a user!", ephemeral: true });
        }

        const channel = interaction.channel;
        if (!channel) {
            return interaction.reply({ content: "❌ Could not access the channel.", ephemeral: true });
        }

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const userMessages = messages.filter(msg => msg.author.id === targetUser.id).first(50);

            if (userMessages.length === 0) {
                return interaction.reply({ content: `⚠️ No messages found from ${targetUser.username}.`, ephemeral: true });
            }

            await channel.bulkDelete(userMessages, true);
            await interaction.reply({ content: `✅ Deleted ${userMessages.length} messages from ${targetUser.username}.` });
        } catch (error) {
            console.error("Clear command error:", error);
            await interaction.reply({ content: "❌ Error deleting messages.", ephemeral: true });
        }
    }
});

// 📊 Handle Poll Button Clicks
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const pollId = interaction.message.id;
    if (!activePolls.has(pollId)) return;

    const pollData = activePolls.get(pollId);
    const userId = interaction.user.id;

    if (pollData.votes.has(userId)) {
        return interaction.reply({ content: "⚠️ You have already voted!", ephemeral: true });
    }

    pollData.votes.set(userId, interaction.customId);

    const totalVotes = pollData.votes.size;
    await interaction.reply({ content: `🗳️ Vote counted! Total votes: ${totalVotes}`, ephemeral: true });
});

// 📢 Function to send a poll
async function sendPoll(channel) {
    const pollQuestion = "📢 **Vote to ban a member!**";
    const options = ["Yes", "No", "Let Them Duel!"];

    const buttons = options.map((option, index) => 
        new ButtonBuilder()
            .setCustomId(`poll_${index}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);
    const pollMessage = await channel.send({ content: pollQuestion, components: [row] });

    console.log("✅ Poll sent successfully!");
    activePolls.set(pollMessage.id, { votes: new Collection(), options });

    setTimeout(async () => {
        await endPoll(pollMessage);
    }, 120000);
}

// 🛠️ Register Slash Commands
client.on('ready', async () => {
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
                .setDescription('Creates a vote to kick a member.')
        );

        await guild.commands.create(
            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clears the last 50 messages from a specified user.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose messages you want to clear')
                        .setRequired(true)
                )
        );

        console.log("✅ Slash commands `/votekick` and `/clear` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
    }
});

// 🚀 Login the bot
client.login(process.env.DISCORD_TOKEN);
