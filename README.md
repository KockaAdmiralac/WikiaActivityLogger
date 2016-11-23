# WikiaActivityLogger
A simple tool built in [Node.js](https://nodejs.org) for logging activity of a [Wikia](http://community.wikia.com) wiki through several transports (currently only supported transport is [Discord](https://discordapp.com)).

Documentation can be found [here](http://kocka.wikia.com/wiki/WikiaActivityLogger)

## TODO
- Better fetch system? Like really, polling isn't a good idea at all but I've no idea what other to use
- Caching
- [New wiki log](http://c.wikia.com/wiki/Special:Newwikis)
- GUI. Electron. Stuff
- Use `export` and `import` instead of `module.exports`

## Known bugs
- If the thread gets moved the logger still shows the old board (Wikia y u do dis to me ;-;)
- Rate limit error fixes
- Better escaping edit summaries
    - Templates
    - Links
    - Asterisks
- Unknown `aflpermissionerror` error?
