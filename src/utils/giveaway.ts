import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";
import { redis } from "./redis.ts";

const ACTIVE_GIVEAWAYS_KEY = "giveaways:active";
const GIVEAWAY_ID_PREFIX = "giveaway:";

const scheduledGiveaways = new Map<string, NodeJS.Timeout>();

export interface GiveawayRecord {
  id: string;
  prize: string;
  winnerCount: number;
  hostId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  endsAt: number;
  ended: boolean;
}

function getGiveawayKey(giveawayId: string) {
  return `giveaways:data:${giveawayId}`;
}

function getParticipantsKey(giveawayId: string) {
  return `giveaways:participants:${giveawayId}`;
}

function parseGiveaway(rawGiveaway: string | null): GiveawayRecord | null {
  if (!rawGiveaway) {
    return null;
  }

  try {
    return JSON.parse(rawGiveaway) as GiveawayRecord;
  } catch (error) {
    console.error("Failed to parse giveaway data:", error);
    return null;
  }
}

async function setGiveaway(record: GiveawayRecord) {
  await redis.set(getGiveawayKey(record.id), JSON.stringify(record));
}

export function isGiveawayButton(customId: string) {
  return customId.startsWith(GIVEAWAY_ID_PREFIX);
}

export function buildGiveawayComponents(giveawayId: string) {
  const joinButton = new ButtonBuilder()
    .setCustomId(giveawayId)
    .setLabel("🎉 Join Giveaway")
    .setStyle(ButtonStyle.Success);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton)];
}

export function buildGiveawayEmbed(record: GiveawayRecord) {
  return new EmbedBuilder()
    .setTitle("🎁 Giveaway Started!")
    .setDescription(
      [
        `**Prize:** ${record.prize}`,
        `**Winners:** ${record.winnerCount}`,
        `**Hosted by:** <@${record.hostId}>`,
        `**Ends:** <t:${Math.floor(record.endsAt / 1000)}:R>`,
        "",
        "Click the button below to enter!",
      ].join("\n"),
    )
    .setColor(0xff4f87)
    .setTimestamp(new Date(record.endsAt));
}

function buildEndedGiveawayEmbed(record: GiveawayRecord, entryCount: number) {
  return new EmbedBuilder()
    .setTitle("🎉 Giveaway Ended")
    .setDescription(
      [
        `**Prize:** ${record.prize}`,
        `**Hosted by:** <@${record.hostId}>`,
        `**Entries:** ${entryCount}`,
      ].join("\n"),
    )
    .setColor(0xff4f87)
    .setTimestamp(new Date());
}

function clearGiveawaySchedule(giveawayId: string) {
  const timeout = scheduledGiveaways.get(giveawayId);
  if (timeout) {
    clearTimeout(timeout);
    scheduledGiveaways.delete(giveawayId);
  }
}

async function getGiveaway(giveawayId: string) {
  return parseGiveaway(await redis.get<string>(getGiveawayKey(giveawayId)));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

async function fetchGiveawayMessage(client: Client, record: GiveawayRecord) {
  const channel = await client.channels.fetch(record.channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`Channel ${record.channelId} is not a text channel.`);
  }

  return (channel as GuildTextBasedChannel).messages.fetch(record.messageId);
}

export async function createGiveaway(record: GiveawayRecord, client: Client) {
  await Promise.all([
    setGiveaway(record),
    redis.zadd(ACTIVE_GIVEAWAYS_KEY, {
      score: record.endsAt,
      member: record.id,
    }),
  ]);

  scheduleGiveaway(client, record);
}

export async function concludeGiveaway(client: Client, giveawayId: string) {
  clearGiveawaySchedule(giveawayId);

  const record = await getGiveaway(giveawayId);
  if (!record) {
    await redis.zrem(ACTIVE_GIVEAWAYS_KEY, giveawayId);
    return;
  }

  if (record.ended) {
    await redis.zrem(ACTIVE_GIVEAWAYS_KEY, giveawayId);
    return;
  }

  record.ended = true;
  await Promise.all([
    setGiveaway(record),
    redis.zrem(ACTIVE_GIVEAWAYS_KEY, giveawayId),
  ]);

  const participants = await redis.smembers<string[]>(
    getParticipantsKey(giveawayId),
  );
  const endedEmbed = buildEndedGiveawayEmbed(record, participants.length);

  if (participants.length === 0) {
    endedEmbed.addFields({
      name: "Result",
      value: "No valid entries. Giveaway cancelled.",
    });
  } else {
    const winners = shuffle(participants).slice(
      0,
      Math.min(record.winnerCount, participants.length),
    );
    const winnerMentions = winners
      .map((winnerId) => `<@${winnerId}>`)
      .join(", ");

    endedEmbed.addFields({
      name: "Winner(s)",
      value: winnerMentions,
    });
  }

  try {
    const message = await fetchGiveawayMessage(client, record);
    await message.edit({
      embeds: [endedEmbed],
      components: [],
    });

    if (participants.length > 0) {
      const winners = endedEmbed.data.fields?.find(
        (field) => field.name === "Winner(s)",
      )?.value;
      if (winners) {
        await message.reply({
          content: `🎊 Congrats ${winners}! You won **${record.prize}**!`,
        });
      }
    }
  } catch (error) {
    console.error(`Failed to conclude giveaway ${giveawayId}:`, error);
  }
}

export async function recoverGiveaways(client: Client) {
  const giveawayIds = await redis.zrange<string[]>(
    ACTIVE_GIVEAWAYS_KEY,
    "-inf",
    "+inf",
    { byScore: true },
  );

  for (const giveawayId of giveawayIds) {
    const record = await getGiveaway(giveawayId);
    if (!record) {
      await redis.zrem(ACTIVE_GIVEAWAYS_KEY, giveawayId);
      continue;
    }

    if (record.ended) {
      await redis.zrem(ACTIVE_GIVEAWAYS_KEY, giveawayId);
      continue;
    }

    scheduleGiveaway(client, record);
  }
}

export function scheduleGiveaway(client: Client, record: GiveawayRecord) {
  clearGiveawaySchedule(record.id);

  const delay = Math.max(record.endsAt - Date.now(), 0);
  const timeout = setTimeout(() => {
    concludeGiveaway(client, record.id).catch((error) => {
      console.error(`Failed to process giveaway ${record.id}:`, error);
    });
  }, delay);

  scheduledGiveaways.set(record.id, timeout);
}

export async function handleGiveawayButton(interaction: ButtonInteraction) {
  if (!isGiveawayButton(interaction.customId)) {
    return false;
  }

  const record = await getGiveaway(interaction.customId);
  if (!record) {
    await interaction.reply({
      content: "This giveaway could not be found anymore.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (record.ended || record.endsAt <= Date.now()) {
    await concludeGiveaway(interaction.client, record.id);
    await interaction.reply({
      content: "This giveaway has already ended 🎉",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const added = await redis.sadd(
    getParticipantsKey(record.id),
    interaction.user.id,
  );
  if (added === 0) {
    await interaction.reply({
      content: "You're already in this giveaway 🎟️",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const participantCount = await redis.scard(getParticipantsKey(record.id));
  await interaction.reply({
    content: `You're in! Good luck 🍀 (Total entries: ${participantCount})`,
    flags: MessageFlags.Ephemeral,
  });

  return true;
}
