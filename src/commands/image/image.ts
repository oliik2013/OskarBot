import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("oskar")
    .setDescription("Sends a random image of Oskar"),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const imageResponse = await fetch("https://oskarapi-cat-api.sigmatwojastara.workers.dev/raw");
    const imageData = Buffer.from(await imageResponse.arrayBuffer());
    console.log(imageData.length);
    const attachment = new AttachmentBuilder(imageData, { name: "oskar.jpg", description: "Picture of Oskar the cat" });
    await interaction.followUp({ files: [attachment] });
  },
};
