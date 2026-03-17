import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ClientType } from "../../types.ts";
export default {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pauses music"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const client = interaction.client as ClientType;
    const guild = interaction.guild;
    if (!guild) return;
    const player = client.players.get(interaction.guild.id);
    if (!player) return await interaction.followUp("No music playing!");
    player.pause();
    await interaction.followUp("Music paused!");
  },
};