import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ClientType } from "../../types.ts";
import NodeID3 from "node-id3";
import { parseFile } from "music-metadata";

export async function getDuration(filePath: string): Promise<number> {
  const metadata = await parseFile(filePath);
  return metadata.format.duration ?? 0;
}

function formatFancyDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", `${s}s`]
    .filter(Boolean)
    .join(" ");
}

export default {
  data: new SlashCommandBuilder()
    .setName("song")
    .setDescription("Shows information about the currently playing song"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    if (!interaction.guildId) {
      await interaction.followUp("This command is only available in servers!");
      return;
    }
    const resource = (interaction.client as ClientType).audioResources.get(
      interaction.guildId
    );

    if (!resource) {
      await interaction.followUp("No music is currently playing!");
      return;
    }

    const filename = (resource.metadata as { filename: string })
      ?.filename as string;
    const resourceTags = NodeID3.read(filename);
    const duration = await getDuration(filename);
    const percent = (resource.playbackDuration / 1000 / duration) * 100;
    await interaction.followUp({
      embeds: [
        {
          title: resourceTags.title ?? "Unknown",
          thumbnail: {
            url: "attachment://cover.png",
          },
          fields: [
            {
              name: "Author",
              value: resourceTags.artist ?? "Unknown",
              inline: true,
            },
            {
              name: "Album",
              value: resourceTags.album ?? "Unknown",
              inline: true,
            },
            {
              name: "Progress",
              value: `${formatFancyDuration(
                resource.playbackDuration / 1000
              )} / ${formatFancyDuration(duration)} (${percent.toFixed(0)}%)`,
              inline: false,
            },
          ],
        },
      ],
      files: [
        {
          name: "cover.png",
          attachment:
            (resourceTags.image as { imageBuffer?: Buffer }).imageBuffer ??
            "attachment://cover.png",
        },
      ],
    });
  },
};