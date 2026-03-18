import { ChannelType, Guild, User, VoiceChannel } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from "@discordjs/voice";
import { existsSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { fileURLToPath } from "url";
import type { ClientType } from "../types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveAudioPath(filename: string): string {
  if (isAbsolute(filename)) {
    return filename;
  }

  const cwdPath = join(process.cwd(), filename);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  return join(__dirname, "..", "..", filename);
}

/**
 * Gets all voice channels in a guild
 */
export function getVoiceChannels(guild: Guild): VoiceChannel[] {
  return guild.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildVoice)
    .map((channel) => channel as VoiceChannel);
}

/**
 * Checks if a voice channel has any members in it
 */
export function hasMembers(channel: VoiceChannel): boolean {
  return channel.members.size > 0;
}

/**
 * Joins a voice channel
 */
export function joinChannel(channel: VoiceChannel) {
  const existingConnection = getVoiceConnection(channel.guild.id);
  if (existingConnection) {
    try {
      existingConnection.destroy();
    } catch (error) {
      console.error("Failed to destroy existing voice connection:", error);
    }
  }

  return joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });
}

/**
 * Plays an MP3 file in a voice channel
 */
export async function playAudio(channel: VoiceChannel, filename: string) {
  const filePath = resolveAudioPath(filename);
  if (!existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const connection = joinChannel(channel);

  const destroyConnection = () => {
    try {
      connection.destroy();
    } catch (error) {
      console.error("Failed to destroy voice connection:", error);
    }
  };

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    console.error(
      `Voice connection was not ready in ${channel.name}:`,
      error
    );
    destroyConnection();
    return false;
  }

  const player = createAudioPlayer();
  const resource = createAudioResource(filePath, {
    inputType: StreamType.Arbitrary,
  });
  const subscription = connection.subscribe(player);

  if (!subscription) {
    destroyConnection();
    throw new Error(`Failed to subscribe to player in ${channel.name}`);
  }

  player.play(resource);

  try {
    await entersState(player, AudioPlayerStatus.Playing, 20_000);
    await entersState(player, AudioPlayerStatus.Idle, 120_000);
    return true;
  } catch (error) {
    console.error(`playAudio failed in ${channel.name}:`, error);
    return false;
  } finally {
    subscription.unsubscribe();
    destroyConnection();
  }
}

export async function playAudioPlaylist(
  channel: VoiceChannel,
  filenames: string[],
  playlistPath: string,
  user: User,
  startingSong?: string
) {
  if (filenames.length === 0) return;

  const connection = joinChannel(channel);
  const player = createAudioPlayer();
  (channel.client as ClientType).players.set(channel.guild.id, player);
  console.log("Player created");
  console.log((channel.client as ClientType).players.get(channel.guild.id));
  connection.subscribe(player);

  function playRandomSong() {
    const filename = filenames[Math.floor(Math.random() * filenames.length)];
    const filePath = join(process.cwd(), playlistPath, filename ?? "");
    console.log(`Playing ${filename}`);
    console.log(filePath);

    const resource = createAudioResource(filePath, {
      inputType: StreamType.Arbitrary,
      metadata: {
        filename: filePath,
      },
    });
    (channel.client as ClientType).audioResources.set(
      channel.guild.id,
      resource
    );

    player.play(resource);
  }

  player.on(AudioPlayerStatus.Playing, () => {
    console.log("Audio started playing");
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("Audio finished, moving to next");
    setTimeout(() => {
      playRandomSong();
    }, 500);
  });

  player.on("error", (error) => {
    console.error("Audio player error:", error);
    setTimeout(() => {
      playRandomSong();
    }, 500);
  });

  if (startingSong) {
    const filename = startingSong;
    const filePath = join(process.cwd(), playlistPath, filename ?? "");
    console.log(`Playing ${filename}`);
    console.log(filePath);
    const resource = createAudioResource(filePath, {
      inputType: StreamType.Arbitrary,
      metadata: {
        filename: filePath,
      },
    });
    (channel.client as ClientType).audioResources.set(
      channel.guild.id,
      resource
    );

    player.play(resource);
  } else {
    playRandomSong();
  }

  return player;
}
