import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ClientType } from "../../types.js";
export default {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resumes music"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const client = interaction.client as ClientType;
    const guild = interaction.guild;
    if (!guild) return;
    const player = client.players.get(interaction.guild.id);
    if (!player) return await interaction.followUp("No music playing!");
    player.unpause();
    await interaction.followUp("Music resumed!");
  },
};