import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  buildGiveawayComponents,
  buildGiveawayEmbed,
  createGiveaway,
  type GiveawayRecord,
} from "../../utils/giveaway.ts";

const command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Start a simple giveaway")
    .addStringOption((option) =>
      option
        .setName("prize")
        .setDescription("What are you giving away?")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration in minutes")
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("winners")
        .setDescription("How many winners")
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const ownerId = process.env.OWNER_ID;
    if (interaction.user.id !== ownerId) {
      return;
    }

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

    await interaction.reply({
      embeds: [
        buildGiveawayEmbed({
          id: giveawayId,
          prize,
          winnerCount,
          hostId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          messageId: "pending",
          endsAt,
          ended: false,
        }),
      ],
      components: buildGiveawayComponents(giveawayId),
    });

    const message = await interaction.fetchReply();
    const giveawayRecord: GiveawayRecord = {
      id: giveawayId,
      prize,
      winnerCount,
      hostId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      endsAt,
      ended: false,
    };

    await createGiveaway(giveawayRecord, interaction.client);
  },

  async autocomplete() {
    // no autocomplete needed
  },
};

export default command;
