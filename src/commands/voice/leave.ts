import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Makes the bot leave its current voice channel"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const connection = getVoiceConnection(interaction.guildId ?? "");
    if (!connection) {
      await interaction.followUp("I'm not in a voice channel!");
      return;
    }

    connection.destroy();
    await interaction.followUp("Left the voice channel!");
  },
};
