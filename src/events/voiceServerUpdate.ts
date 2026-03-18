import { Events } from "discord.js";
import type { ClientType, EventType } from "../types.ts";

export default {
  eventType: Events.VoiceServerUpdate,
  execute: (client: ClientType, data: any) => {
    console.log(`[Voice Event] Server update received for guild ${data.guild_id}: ${data.endpoint}`);
  },
} as EventType;
