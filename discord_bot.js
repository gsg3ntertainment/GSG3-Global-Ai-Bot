client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'mappoll') {
            await interaction.reply({ content: "🗳️ Creating a map poll...", ephemeral: true });
            const channel = interaction.channel;
            if (!channel) {
                return interaction.followUp({ content: "❌ Could not access the channel.", ephemeral: true });
            }
            sendPoll(channel);
        }
        return;
    }

    if (interaction.isButton()) {
        if (!interaction.customId.startsWith('poll_')) return;

        const pollData = activePolls.get(interaction.message.id);
        if (!pollData) {
            return interaction.reply({ content: "❌ This poll is no longer active.", ephemeral: true });
        }

        const voteIndex = parseInt(interaction.customId.replace('poll_', ''), 10);
        const selectedOption = pollData.options[voteIndex];

        if (!selectedOption) {
            return interaction.reply({ content: "❌ Invalid vote option.", ephemeral: true });
        }

        // Track user votes
        pollData.votes.set(interaction.user.id, selectedOption);

        await interaction.reply({ content: `✅ You voted for **${selectedOption}**!`, ephemeral: true });
    }
});
