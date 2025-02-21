import { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
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

// Slash Command: /mappoll
client.on('interactionCreate', async (interaction) => {
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

// Function to end the poll and show results
async function endPoll(pollMessage) {
    const pollData = activePolls.get(pollMessage.id);
    if (!pollData) return;

    const voteCounts = new Map();
    pollData.options.forEach(option => voteCounts.set(option, 0));

    pollData.votes.forEach(vote => {
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
    });

    let results = "**🗳️ Poll Results:**\n";
    pollData.options.forEach(option => {
        results += `**${option}:** ${voteCounts.get(option)} votes\n`;
    });

    await pollMessage.channel.send(results);
    activePolls.delete(pollMessage.id);

    // Optional: Delete poll message after results
    setTimeout(() => pollMessage.delete().catch(() => {}), 5000);
}

// Handle poll button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const pollData = activePolls.get(interaction.message.id);
    if (!pollData) return;

    const userId = interaction.user.id;
    if (pollData.votes.has(userId)) {
        await interaction.reply({ content: "⚠️ You can only vote once!", ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const optionIndex = parseInt(interaction.customId.replace("poll_", ""));
    if (isNaN(optionIndex) || optionIndex >= pollData.options.length) return;

    const chosenOption = pollData.options[optionIndex];
    pollData.votes.set(userId, chosenOption);

    try {
        await interaction.followUp({ content: `✅ You voted for **${chosenOption}**!`, ephemeral: true });
    } catch (error) {
        console.error("Failed to reply to interaction:", error);
    }
});

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
    }

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const userMessages = messages
            .filter(msg => msg.author.id === targetUser.id)
            .first(50);

        if (userMessages.length === 0) {
            return interaction.reply({ content: `⚠️ No messages found from ${targetUser.username}.`, ephemeral: true });
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

        console.log("✅ Slash commands `/mappoll` and `/clear` registered.");
    } catch (error) {
        console.error("❌ Error registering slash commands:", error);
    }
});

// Login the bot
client.login(process.env.DISCORD_TOKEN);
