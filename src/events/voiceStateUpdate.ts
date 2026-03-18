import { Events, VoiceState } from "discord.js";
import type { ClientType, EventType } from "../types.ts";

export default {
  eventType: Events.VoiceStateUpdate,
  execute: (client: ClientType, oldState: VoiceState, newState: VoiceState) => {
    if (newState.member?.user.bot) {
      console.log(`[Voice Event] State updated for ${newState.member.user.tag}: ${oldState.channelId} -> ${newState.channelId}`);
    }
  },
} as EventType;
