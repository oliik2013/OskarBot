### FORKED FROM: [https://github.com/notmqrc/OskarBot](https://github.com/notmqrc/OskarBot), had to leave fork network.

# Oskar - AI Cat Discord Bot

An AI-powered Discord bot that simulates an 8-month-old black cat named Oskar. The bot responds to mentions with personality-driven messages, plays music in voice channels, and can send announcements to multiple servers.

## Features

- **AI Chat**: Responds to mentions with cat-like personality using Groq AI
- **Voice Chat**: Plays music in voice channels, can stop playback, and reports current song
- **Image Responses**: Can send pictures of Oskar when requested
- **Rate Limiting**: Built-in rate limiting to prevent abuse (25 messages per 5 hours)
- **Multi-server Announcements**: Owner can send announcements to multiple channels across servers
- **Purr Audio**: Randomly plays purring sounds in voice channels (25% chance every 5 minutes)

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env`:
   ```
   BOT_CLIENT_ID=your_bot_client_id
   BOT_TOKEN=your_bot_token
   GROQ_API_KEY=your_groq_api_key
   OWNER_ID=your_discord_user_id
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```

3. Run the bot:
   ```bash
   pnpm dev
   ```

## Commands

### Slash Commands

- `/announce` - Send an announcement to multiple channels (owner only)
  - Format for targets: `guildId:channelId` (one per line or semicolon-separated)
  - Example: `1317301859400028160:1234567890;1234567890:0987654321`

- `/limit` - Check your remaining message limit and request a reset

- `/blacklist` - Blacklist a user (owner only)

### Voice Commands

- `/play` - Play music in your voice channel
- `/pause` - Pause current playback
- `/resume` - Resume paused playback
- `/leave` - Leave the voice channel
- `/song` - Show current song info
- `/meow` - Play a meow sound

### Image Commands

- `/image` - Get a random image of Oskar

## Bot Behavior

- Responds when mentioned with `@Oskar` or when replying to the bot's messages
- Uses custom emojis: `:oskarmeem:` and `:cute_oskar:`
- Personality traits: loves hiding under the sofa, watching fish tanks and birds, hates sunbeams, loves meowing
- Occasionally purrs in voice channels (25% chance every 5 minutes)

## Project Structure

```
src/
├── commands/          # Discord slash commands
│   ├── image/        # Image commands
│   ├── utils/        # Utility commands (announce, limit, blacklist)
│   └── voice/        # Voice-related commands
├── events/           # Discord event handlers
│   └── message.ts    # Message create event
├── utils/            # Utility functions
│   ├── redis.ts      # Rate limiting with Upstash Redis
│   └── voice.ts      # Voice channel utilities
├── lib.ts            # AI logic and prompt configuration
├── main.ts           # Bot entry point
├── register.ts       # Command registration
└── types.ts          # TypeScript type definitions
```

## License

[MIT](LICENSE)
