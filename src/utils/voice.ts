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
  
  // Force a fresh connection if the existing one is not Ready
  if (existingConnection && existingConnection.state.status !== VoiceConnectionStatus.Ready) {
    console.error(`[Voice Join] Destroying existing ${existingConnection.state.status} connection to ${channel.name}`);
    try {
      existingConnection.destroy();
    } catch {}
  } else if (existingConnection && existingConnection.joinConfig.channelId === channel.id) {
    return existingConnection;
  }

  console.error(`[Voice Join] Creating new connection to ${channel.name} (${channel.id}) in guild ${channel.guild.id}`);
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: (methods) => {
      console.error(`[Voice Adapter] Creator called for guild ${channel.guild.id}`);
      const adapter = channel.guild.voiceAdapterCreator(methods);
      return {
        sendPayload: (payload) => {
          if (payload.op === 4) {
             console.error(`[Voice Adapter] Sending op 4 (Join Voice) to gateway`);
          }
          return adapter.sendPayload(payload);
        },
        destroy: () => {
          console.error(`[Voice Adapter] Destroy called`);
          return adapter.destroy();
        },
      };
    },
    selfDeaf: true,
    selfMute: false,
    debug: true,
  });

  // Attach debug and error listeners immediately
  connection.on("debug", (message) => {
    console.error(`[Voice Debug] ${message}`);
  });

  connection.on("error", (error) => {
    console.error(`[Voice Error] ${channel.name}: ${error.message}`);
  });

  return connection;
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
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      try {
        connection.destroy();
      } catch (error) {
        console.error("Failed to destroy voice connection:", error);
      }
    }
  };

  // Log state changes to help debug
  connection.on("stateChange", (oldState, newState) => {
    console.error(`[Voice State] ${channel.name}: ${oldState.status} -> ${newState.status}`);
  });

  // Enable library debug logging
  connection.on("debug", (message) => {
    console.error(`[Voice Debug] ${message}`);
  });

  const checkInterval = setInterval(() => {
    if (connection.state.status !== VoiceConnectionStatus.Ready &&
        connection.state.status !== VoiceConnectionStatus.Destroyed) {
      console.error(`[Voice Check] Still ${connection.state.status} in ${channel.name}...`);
    }
  }, 5000);

  // Small delay before waiting for state to help with transient issues in some environments
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Skip entersState for connection - the library will queue audio until ready
  // or fail internally if it can't connect, which we'll catch on the player.

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

  // Monitor player errors
  player.on("error", (error) => {
    console.error(`AudioPlayer error in ${channel.name}:`, error.message, error.resource);
  });

  try {
    console.error(`[Voice Play] Waiting for player to start in ${channel.name}...`);
    await entersState(player, AudioPlayerStatus.Playing, 35_000);
    console.error(`[Voice Play] Audio started in ${channel.name}!`);
    await entersState(player, AudioPlayerStatus.Idle, 120_000);
    return true;
  } catch (error) {
    console.error(`playAudio failed in ${channel.name}:`, error);
    return false;
  } finally {
    clearInterval(checkInterval);
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

  // Wait for connection to be ready before proceeding
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    console.error(`Playlist connection failed in ${channel.name}:`, error);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
    return;
  }

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
