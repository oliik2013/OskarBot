import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { increaseLimit, ratelimit } from "../../utils/redis.ts";

const LIMIT_REQUEST_BUTTON_ID = "limit-request";
const LIMIT_RESET_BUTTON_PREFIX = "limit-reset:";

function buildOwnerResetButton(userId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${LIMIT_RESET_BUTTON_PREFIX}${userId}`)
      .setLabel("Reset user limit")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🔓")
      .setDisabled(disabled),
  );
}

export async function handleLimitResetButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith(LIMIT_RESET_BUTTON_PREFIX)) {
    return false;
  }

  if (interaction.user.id !== (process.env.OWNER_ID ?? "")) {
    await interaction.reply({
      content: "Only the bot owner can reset limits.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const userId = interaction.customId.slice(LIMIT_RESET_BUTTON_PREFIX.length);
  if (!userId) {
    await interaction.reply({
      content: "This reset request is invalid.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await ratelimit.resetUsedTokens(userId);

  await interaction.update({
    content: `Reset <@${userId}>'s message limit.`,
    components: [buildOwnerResetButton(userId, true)],
  });

  try {
    const user = await interaction.client.users.fetch(userId);
    await user.send("Your message limit was reset. You can talk to Oskar again now.");
  } catch (error) {
    console.error(`Failed to notify user ${userId} about limit reset:`, error);
  }

  return true;
}

export default {
  data: new SlashCommandBuilder()
    .setName("limit")
    .setDescription("Gets info about your ratelimit"),
  async execute(interaction: ChatInputCommandInteraction) {
    const { remaining, reset } = await ratelimit.getRemaining(
      interaction.user.id
    );
    const raiseButton = new ButtonBuilder()
      .setCustomId(LIMIT_REQUEST_BUTTON_ID)
      .setLabel("Ask owner for a reset")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🐈");
    const contentComponent = new TextDisplayBuilder().setContent(
      `You have ${remaining} remaining messages. Resets <t:${Math.floor(
        reset / 1000
      )}:R>.`
    );
    const actionRow = new ActionRowBuilder()
      .addComponents([raiseButton])
      .toJSON();
    const response = await interaction.reply({
      components: [contentComponent, actionRow],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      withResponse: true,
    });

    const confirmation =
      await response.resource?.message?.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });
    if (confirmation?.customId === LIMIT_REQUEST_BUTTON_ID) {
      const { success } = await increaseLimit.limit(interaction.user.id);
      if (!success) {
        await confirmation.reply({
          content: "You have already requested a reset today.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const starNumber = await interaction.client.users.fetch(
        process.env.OWNER_ID ?? ""
      );
      await starNumber.send({
        content: `<@${
          interaction.user.id
        }> has ${remaining} remaining messages. Resets <t:${Math.floor(
          reset / 1000
        )}:R> and requested a limit reset.`,
        components: [buildOwnerResetButton(interaction.user.id)],
      });
      await confirmation.reply({
        content:
          "I asked the owner for a reset on your behalf. Please wait for a reply.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
