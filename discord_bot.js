import { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Collection 
} from 'discord.js';
import dotenv from 'dotenv';
import { OpenAIOperations } from './openai_operations.js';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
});

const openaiOps = new OpenAIOperations(
    'You are a helpful Discord chatbot.',
    process.env.OPENAI_API_KEY,
    process.env.MODEL_NAME,
    process.env.HISTORY_LENGTH
);

const activePolls = new Collection();

client.once('ready', () => {
    console.log(`🤖 Discord Bot is online as ${client.user.tag}`);
});

// Handle Slash Commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'votekick') {
        await interaction.deferReply();
        await sendPoll(interaction);
    } 
    
    else if (interaction.commandName === 'ask') {
        await interaction.deferReply();
        const question = interaction.options.getString('question');
        const aiResponse = await openaiOps.askAI(question);
        await interaction.followUp(aiResponse);
    }
});

// Function to send a poll
async function sendPoll(interaction) {
    const pollQuestion = "📢 **Vote to kick this player?**";
    const options = ["Yes", "No"];

    const buttons = options.map((option, index) => 
        new ButtonBuilder()
            .setCustomId(`poll_${index}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    const pollMessage = await interaction.channel.send({ content: pollQuestion, components: [row] });
    activePolls.set(pollMessage.id, { votes: new Collection(), options });

    setTimeout(async () => {
        await endPoll(pollMessage);
    }, 60000);

    await interaction.followUp({ content: "🗳️ Votekick poll started!", ephemeral: true });
}

// Login the bot
client.login(process.env.DISCORD_TOKEN);
