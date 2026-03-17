import { SlashCommandBuilder, type ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { env } from "process";
import { redis } from "../../utils/redis.ts";

  export default {
    data: new SlashCommandBuilder()
      .setName("blacklist")
      .addSubcommand((subcommand) => subcommand.setName("add").setDescription("Adds a user to the blacklist").addUserOption((option) => option.setName("user").setDescription("The user to add").setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Removes a user from the blacklist").addUserOption((option) => option.setName("user").setDescription("The user to remove").setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName("list").setDescription("Lists all users on the blacklist"))
      .addSubcommand((subcommand) => subcommand.setName("query").setDescription("Gets info about a user on the blacklist").addUserOption((option) => option.setName("user").setDescription("The user to query").setRequired(true)))
      .setDescription("Commands to manage blacklist"),
    async execute(interaction: ChatInputCommandInteraction) {
      if (interaction.user.id !== env.OWNER_ID) return;
      switch (interaction.options.getSubcommand()) {
        case "add": {
            const user = interaction.options.getUser("user");
            if (!user) {
              await interaction.reply({
                content: "Invalid user",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            redis.set(`blacklist:${user.id}`, "true");
            await interaction.reply({
              content: `Added ${user.tag} to the blacklist`,
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
        case "remove": {
            const user = interaction.options.getUser("user");
            if (!user) {
              await interaction.reply({
                content: "Invalid user",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            redis.del(`blacklist:${user.id}`);
            await interaction.reply({
              content: `Removed ${user.tag} from the blacklist`,
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
        case "list": {
            const users = await redis.keys("blacklist:*");
            const userList = users.map((user) => "<@" + user.split(":")[1] + ">");
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle("Blacklist")
                  .setDescription(userList.join("\n"))
              ],
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
        case "query": {
            const user = interaction.options.getUser("user");
            if (!user) {
              await interaction.reply({
                content: "Invalid user",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            const blacklisted = await redis.get(`blacklist:${user.id}`);
            if (blacklisted) {
              await interaction.reply({
                content: `${user.tag} is blacklisted`,
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            await interaction.reply({
              content: `${user.tag} is not blacklisted`,
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
        default: {
          await interaction.reply({
            content: "Invalid subcommand",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    },

  };