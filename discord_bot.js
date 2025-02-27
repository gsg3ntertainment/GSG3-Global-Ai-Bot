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

// Store active polls and votes
const activePolls = new Collection();

// Listen for messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; 

    const content = message.content.trim().toLowerCase();

    if (content.startsWith('!')) {
        const userMessage = content.replace('!', '').trim();
        if (!userMessage) {
            message.reply('Please provide a message after `!`.');
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

// Function to send a poll with a 1-minute timer
async function sendPoll() {
    const channel = client.channels.cache.get(process.env.POLL_CHANNEL_ID);
    if (!channel) {
        console.error("❌ Error: Poll channel not found!");
        return;
    }

    const pollQuestion = "📢 **Vote to kick a user!**";
    const options = ["YES", "NO"];

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
    }, 1200000);
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

    await interaction.deferReply({ ephemeral: true }); // Prevents interaction timeout

    const optionIndex = parseInt(interaction.customId.replace("poll_", ""));
    if (isNaN(optionIndex) || optionIndex >= pollData.options.length) return;

    const chosenOption = pollData.options[optionIndex];
    pollData.votes.set(userId, chosenOption);

    try {
    await interaction.reply({ content: `✅ You voted for **${chosenOption}**!`, ephemeral: true });
} catch (error) {
    console.error("Failed to reply to interaction:", error);
}
});


// Login the bot
client.login(process.env.DISCORD_TOKEN);
