# WikiaActivityLogger
A simple tool built in [Node.js](https://nodejs.org) for logging activity of a [Wikia](http://community.wikia.com) wiki through several transports (currently only supported transport is [Discord](https://discordapp.com)).
## TODO
- Better fetch system? Like really, polling isn't a good idea at all but I've no idea what other to use
- Stability and stuff
- [Special:Newwikis](http://c.wikia.com/wiki/Special:Newwikis) if we're logging [Community Central](http://c.wikia.com)? Idk
- Moar caching
- Fix the bug where if the thread gets moved the logger still shows the old board (Why, Wikia, why)
- Rate limit error fixes
- Use `export` and `import` instead of `module.exports`
- Better escaping edit summaries
    - Templates
    - Links
    - Asterisks
- Unknown `aflpermissionerror` error?
- GUI. Electron. Stuff
