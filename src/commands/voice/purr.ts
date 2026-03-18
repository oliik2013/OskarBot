import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { playAudio } from "../../utils/voice.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("purr")
    .setDescription("Joins a voice chat and purrs")
    .addChannelOption((option) =>
      option
        .addChannelTypes(ChannelType.GuildVoice)
        .setDescription("The voice channel to join")
        .setRequired(false)
        .setName("channel")
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let channel = interaction.options.getChannel("channel");
    const member = interaction.member as GuildMember;
    if (!channel) {
      // Check if user is in a voice channel
      if (!member?.voice?.channel) {
        await interaction.followUp(
          "You need to be in a voice channel or specify a channel!"
        );
        return;
      }
      channel = member.voice.channel;
    }

    if (channel.type !== ChannelType.GuildVoice) {
      await interaction.followUp("That's not a valid voice channel!");
      return;
    }

    const voiceChannel = channel as VoiceChannel;

    if (!voiceChannel.joinable || !voiceChannel.speakable) {
      await interaction.followUp(
        "I can't join or speak in that voice channel. Please adjust my permissions and try again."
      );
      return;
    }

    await interaction.followUp(`purring on <#${channel.id}>!`);
    try {
      await playAudio(voiceChannel, "assets/purr.mp3");
      console.log("Audio played successfully!");
    } catch (error) {
      console.error("Failed to play purr:", error);
      await interaction.followUp(
        "I couldn't play audio in that channel. Please try again later."
      );
    }
  },
};
