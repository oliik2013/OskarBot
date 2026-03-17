import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { playAudioPlaylist } from "../../utils/voice.ts";
import { readdir } from "fs/promises";
import NodeID3 from "node-id3";
export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Plays the music from the 24 hour stream")
    .addStringOption((option) =>
      option
        .setDescription("The song to play first")
        .setName("song")
        .setAutocomplete(true)
        .setRequired(false)
    )
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
    const startingSong = interaction.options.getString("song");
    await interaction.followUp(`Playing music on <#${channel.id}>!`);
    if (startingSong) {
      console.log("starting song: ", startingSong);
      playAudioPlaylist(
        channel as VoiceChannel,
        await readdir("./assets/playlist"),
        "assets/playlist",
        interaction.user,
        startingSong
      );
    } else {
      playAudioPlaylist(
        channel as VoiceChannel,
        await readdir("./assets/playlist"),
        "assets/playlist",
        interaction.user
      );
    }

    console.log("Audio played successfully!");
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const songs = (await readdir("assets/playlist")).map((item) => {
      return {
        fileName: item,
        name: NodeID3.read("assets/playlist/" + item).title,
      };
    });
    const filtered = songs.filter((choice) =>
      (choice.name ?? choice.fileName)
        .toLowerCase()
        .includes(interaction.options.getFocused().toLowerCase())
    );
    await interaction.respond(
      filtered.map((choice) => ({
        name: choice.name ?? choice.fileName,
        value: choice.fileName,
      }))
    );
  },
};