import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from "discord.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Start a simple giveaway")
    .addStringOption((option) =>
      option
        .setName("prize")
        .setDescription("What are you giving away?")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration in minutes")
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("winners")
        .setDescription("How many winners")
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const prize = interaction.options.getString("prize", true);
    const durationMinutes = interaction.options.getInteger("duration", true);
    const winnerCount = interaction.options.getInteger("winners") ?? 1;

    const endsAt = Date.now() + durationMinutes * 60 * 1000;
    const giveawayId = `giveaway:${interaction.id}`;

    const joinButton = new ButtonBuilder()
      .setCustomId(giveawayId)
      .setLabel("🎉 Join Giveaway")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

    const embed = new EmbedBuilder()
      .setTitle("🎁 Giveaway Started!")
      .setDescription([
        `**Prize:** ${prize}`,
        `**Winners:** ${winnerCount}`,
        `**Hosted by:** <@${interaction.user.id}>`,
        `**Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
        "",
        "Click the button below to enter!",
      ].join("\n"))
      .setColor(0xff4f87)
      .setTimestamp(new Date(endsAt));

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });

    const message = await interaction.fetchReply();
    const participants = new Set<string>();

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.customId === giveawayId,
      time: durationMinutes * 60 * 1000,
    });

    collector.on("collect", async (i: ButtonInteraction) => {
      if (participants.has(i.user.id)) {
        await i.reply({
          content: "You're already in this giveaway 🎟️",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      participants.add(i.user.id);
      await i.reply({
        content: `You're in! Good luck 🍀 (Total entries: ${participants.size})`,
        flags: MessageFlags.Ephemeral,
      });
    });

    collector.on("end", async () => {
      const endedEmbed = EmbedBuilder.from(embed)
        .setTitle("🎉 Giveaway Ended")
        .setDescription([
          `**Prize:** ${prize}`,
          `**Hosted by:** <@${interaction.user.id}>`,
          `**Entries:** ${participants.size}`,
        ].join("\n"))
        .setTimestamp(new Date());

      const users = [...participants];
      if (users.length === 0) {
        endedEmbed.addFields({
          name: "Result",
          value: "No valid entries. Giveaway cancelled.",
        });

        await interaction.editReply({
          embeds: [endedEmbed],
          components: [],
        });
        return;
      }

      const shuffled = users.sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, Math.min(winnerCount, shuffled.length));
      const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");

      endedEmbed.addFields({
        name: "Winner(s)",
        value: winnerMentions,
      });

      await interaction.editReply({
        embeds: [endedEmbed],
        components: [],
      });

      await interaction.followUp({
        content: `🎊 Congrats ${winnerMentions}! You won **${prize}**!`,
      });
    });
  },

  async autocomplete() {
    // no autocomplete needed
  },
};

export default command;
