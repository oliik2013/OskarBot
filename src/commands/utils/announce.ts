import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { CommandType } from "../../types.ts";

const OWNER_ID = process.env.OWNER_ID;

const command: CommandType = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to multiple channels (Owner only)")
    .addStringOption((option) =>
      option
        .setName("targets")
        .setDescription("List of channel targets in format: guildId:channelId (one per line or semicolon-separated)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The announcement message")
        .setRequired(true)
    ) as CommandType["data"],
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({
        content: "❌ You don't have permission to use this command! Only the bot owner can announce.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetsInput = interaction.options.getString("targets", true);
    const message = interaction.options.getString("message", true);

    const targets = targetsInput
      .split(/[;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.includes(":"))
      .map((t) => {
        const [guildId, channelId] = t.split(":");
        return { guildId: guildId.trim(), channelId: channelId.trim() };
      });

    if (targets.length === 0) {
      await interaction.reply({
        content: "❌ No valid targets provided. Use format: guildId:channelId",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const results: { guild: string; channel: string; success: boolean }[] = [];

    await interaction.reply({
      content: `📢 Sending announcement to ${targets.length} channel(s)...`,
      flags: MessageFlags.Ephemeral,
    });

    for (const target of targets) {
      try {
        const guild = await interaction.client.guilds.fetch(target.guildId);
        if (!guild) {
          results.push({ guild: target.guildId, channel: target.channelId, success: false });
          continue;
        }

        const channel = await guild.channels.fetch(target.channelId);
        if (!channel || !channel.isTextBased()) {
          results.push({ guild: guild.name, channel: target.channelId, success: false });
          continue;
        }

        await channel.send(message);
        results.push({ guild: guild.name, channel: channel.name, success: true });
      } catch (error) {
        console.error("Error sending to", target, error);
        results.push({ guild: target.guildId, channel: target.channelId, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    const responseText = [
      `✅ Successfully sent to ${successCount} channel(s):`,
      ...results
        .filter((r) => r.success)
        .map((r) => `  • ${r.guild} #${r.channel}`),
      failCount > 0 ? `\n❌ Failed to send to ${failCount} channel(s):` : null,
      ...results
        .filter((r) => !r.success)
        .map((r) => `  • ${r.guild} #${r.channel}`),
    ]
      .filter(Boolean)
      .join("\n");

    await interaction.editReply({
      content: responseText,
    });
  },
  async autocomplete() {
    // No autocomplete needed
  },
};

export default command;
