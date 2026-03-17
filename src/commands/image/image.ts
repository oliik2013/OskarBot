import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("oskar")
    .setDescription("Sends a random image of Oskar"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const imageResponse = await fetch("https://oskarapi.starnumber12046.workers.dev/oskar");
    const imageData = Buffer.from(await imageResponse.arrayBuffer());
    console.log(imageData.length);
    await interaction.followUp({ files: [imageData] });
  },
};
