# WikiaActivityLogger
A simple tool built in [Node.js](https://nodejs.org) for logging activity of a [Wikia](https://community.wikia.com) wiki through several transports (currently only supported transports are [Discord](https://discordapp.com), desktop notifications and [Slack](https://slack.com)).

Documentation can be found [here](https://dev.wikia.com/wiki/WikiaActivityLogger)

## TODO
- Better fetch system? Like really, polling isn't a good idea at all but I've no idea what other to use
- Caching
- GUI. Electron. Stuff
- Use `export` and `import` instead of `module.exports`
- Auto-updater or at least update notification
- Extensions. Especially abuse filter extension.

## Known bugs
- If the thread gets moved the logger still shows the old board (Wikia y u do dis to me ;-;)
- `aflpermissionerror` error?
- Weird issue with message type not being passed when ratelimited
- Thread title characters are HTML entities sometimes
