const GameLauncher = require('./game-launcher');
const _ = require('lodash');
const fs = require('fs');
const Bots = require('../model/bot');
const Fights = require('../model/fight');

const request = require('request-promise');

const LEAGUE_BOTS_TABLE = 'league_bots';
const botFolder = `${__dirname}/../bots/`;

const GameArena = {

  singleBotFight: async function (fightParams) {

    const {level, userId, botid, code} = fightParams;

    let filename = `junior.js`;

    switch (level) {
      case 'senior':
        filename = 'senior.js';
        break;
      case 'mid-level':
        filename = 'mid-level.js';
        break;
      case 'guru':
        filename = 'guru.js';
        break;
      case 'junior':
      default:
        filename = 'junior.js';
        break;
    }

    filename = `${botFolder}${filename}`;

    const pl2Source = await new Promise((resolve, reject) => {
      fs.readFile(filename, (err, content) => {
        return err ? reject(err) : resolve(content.toString());
      })
    })

    const arenaUrl = `http://${process.env.ARENA_HOST}:${process.env.ARENA_PORT}/bot`

    const requestBody = {
      player: {
        source: code,
        user: userId,
        botid: botid
      },
      bot: {
        source: pl2Source,
        botid: level
      }
    }

    const gameHistory = await request({
      method: 'POST',
      uri: arenaUrl,
      body: requestBody,
      json: true
    });

    if (gameHistory.error) {
      return gameHistory
    }

    const team = gameHistory.players[0].troop.map(soldier => soldier.type)
    const botName = gameHistory.players[0].name;

    const updatedBot = {
      botid: botid,
      user: userId,
      source: code,
      name: botName,
      team
    }

    await GameArena.saveBotAfterSingleFight(updatedBot);

    return gameHistory;

  },

  singleChallengeFight: async function (fightParams) {

    const {
      challenge,
      code,
      userId,
      botid
    } = fightParams;

    const enemyBot = await Bots.one({botid: challenge}, LEAGUE_BOTS_TABLE);

    if (!enemyBot) {
      throw new Error('Invalid challenger');
    }

    const arenaUrl = `http://${process.env.ARENA_HOST}:${process.env.ARENA_PORT}/bot`

    const requestBody = {
      player: {
        source: code,
        user: userId,
        botid: botid
      },
      bot: {
        source: enemyBot.source,
        botid: challenge,
        user: enemyBot.user
      }
    }

    const gameHistory = await request({
      method: 'POST',
      uri: arenaUrl,
      body: requestBody,
      json: true
    });

    if (gameHistory.error) {
      return gameHistory;
    }

    const botName = gameHistory.players[0].name;
    const team = gameHistory.players[0].troop.map(soldier => soldier.type);

    const updatedBot = {
      botid: botid,
      user: userId,
      source: code,
      name: botName,
      team
    };

    await GameArena.saveBotAfterSingleFight(updatedBot);

    return gameHistory;

  },

  saveBotAfterSingleFight: async function (bot) {

    const userBot = await Bots.one({botid: bot.botid});

    // se non esiste, lo creo al volo
    if (!userBot) {
      
      const newBot = {
        botid: bot.botid,
        user: bot.user,
        source: bot.source,
        name: bot.name,
        team: bot.team
      };

      return await Bots.add(newBot);
    }

    // se il bot è effettivamente dell'utente, lo aggiorno
    if (userBot.user === bot.user) {
      return await Bots.update({botid: bot.botid, user: bot.user}, {
        source: bot.source,
        name: bot.name,
        team: bot.team,
        timestamp: Math.round((+new Date()) / 1000)
      })
    }

    // bot non dell'utente che sta facendo la richiesta
    throw new Error('These are not the droids your looking for')

  },

  /**
   *
   * @param bot
   * @returns {Promise<*>}
   */
  start: async function (bot) {

    try {

      // CHECK TIMESTAMPS
      await GameArena.canRun(bot);

      // EXEC FIGHTS
      const {fights, homeFightExample} = await GameArena.fight(bot);

      // SAVE BOT
      await GameArena.saveBot(bot, fights, homeFightExample);

      // SAVE FIGHTS
      await GameArena.saveFights(fights, bot.botid);

      // WRITE LEADERBOARD
      const leaderboard = await Fights.computeLeaderboard();
      await new Promise((resolve, reject) => {
        fs.writeFile('./leaderboard.json', JSON.stringify(leaderboard), (err) => {
          return err ? reject(err) : resolve()
        });
      });

      return {
        exit: 'OK'
      };


    } catch (err) {
      console.error(err);
      return {
        exit: 'KO',
        message: err.error
      };
    }


  },

  /**
   *
   * @return {Promise<{fights: Array, homeFightExample: undefined}>}
   */
  rerun: async function() {

    // recupera tutti i bot in gioco
    const enemies = await Bots.all(LEAGUE_BOTS_TABLE);

    const fights = [];

    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {

        const bot1 = enemies[i];
        const bot2 = enemies[j];

        const arenaUrl = `http://${process.env.ARENA_HOST}:${process.env.ARENA_PORT}/bot`

        const homeRun = await request({
          method: 'POST',
          uri: arenaUrl,
          body: {
            player: bot1,
            bot: bot2
          },
          json: true
        })

        const awayRun = await request({
          method: 'POST',
          uri: arenaUrl,
          body: {
            player: bot2,
            bot: bot1
          },
          json: true
        })


        // const homeRun = await GameLauncher.launch(bot1, bot2);
        // const awayRun = await GameLauncher.launch(bot2, bot1);

        if (homeRun.error || awayRun.error) {
          console.error(homeRun.error || awayRun.error);
          throw new Error(homeRun.error || awayRun.error);
        }

        const home = {
          id: `${bot1.botid}${bot2.botid}`,
          bot1: bot1.botid,
          bot2: bot2.botid,
          history: homeRun,
          winner: homeRun.exit.winner,
          by: homeRun.exit.by,
          timestamp: Math.round((+new Date()) / 1000)
        };

        const away = {
          id: `${bot2.botid}${bot1.botid}`,
          bot1: bot2.botid,
          bot2: bot1.botid,
          history: awayRun,
          winner: awayRun.exit.winner,
          by: awayRun.exit.by,
          time: Math.round((+new Date()) / 1000)
        };

        fights.push(home, away);

      }

    }

    console.log(`Game arena rerun completed: ${fights.length} fights`)

    await Fights.truncate();
    await Fights.addMany(_.flatten(fights));

    const leaderboard = await Fights.computeLeaderboard();
    await new Promise((resolve, reject) => {
      fs.writeFile('./leaderboard.json', JSON.stringify(leaderboard), (err) => {
        return err ? reject(err) : resolve()
      });
    });

  },

  /**
   *
   * @param bot
   * @returns {Promise<void>}
   */
  canRun: async function (bot) {

    const leagueBot = await Bots.one({botid: bot.botid, user: bot.user}, LEAGUE_BOTS_TABLE)

    if (leagueBot) {
      const now = new Date();
      const sendToLeagueTime = new Date(leagueBot.timestamp);

      const difference = now - sendToLeagueTime;

      if (difference < 5 * 60 * 1000) {
        throw new Error('too soon')
      }

      // console.log(difference);
    }

  },

  saveFights: async function(fights, botId) {

    await Promise.all([
      Fights.delete({bot1: botId}),
      Fights.delete({bot2: botId}),
    ]);

    return await Fights.addMany(_.flatten(fights));

  },

  /**
   *
   * @param bot
   * @returns {Promise<{fights: Array, homeFightExample: undefined}>}
   */
  fight: async function (bot) {

    // recupera tutti i bot in gioco
    const enemies = await Bots.all(LEAGUE_BOTS_TABLE);
    const hrstart = process.hrtime();

    const fights = [];
    let homeFightExample = undefined;

    for (let i = 0; i < enemies.length; i++) {

      if (bot.botid === enemies[i].botid) {
        continue;
      }

      const arenaUrl = `http://${process.env.ARENA_HOST}:${process.env.ARENA_PORT}/bot`

      const homeRun = await request({
        method: 'POST',
        uri: arenaUrl,
        body: {
          player: bot,
          bot: enemies[i]
        },
        json: true
      })

      const awayRun = await request({
        method: 'POST',
        uri: arenaUrl,
        body: {
          player: enemies[i],
          bot: bot
        },
        json: true
      })

      if (homeRun.error || awayRun.error) {
        console.error(homeRun.error || awayRun.error);
        throw new Error(homeRun.error || awayRun.error);
      }

      const home = {
        id: `${bot.botid}${enemies[i].botid}`,
        bot1: bot.botid,
        bot2: enemies[i].botid,
        history: homeRun,
        winner: homeRun.exit.winner,
        by: homeRun.exit.by,
        timestamp: Math.round((+new Date()) / 1000)
      };

      const away = {
        id: `${enemies[i].botid}${bot.botid}`,
        bot1: enemies[i].botid,
        bot2: bot.botid,
        history: awayRun,
        winner: awayRun.exit.winner,
        by: awayRun.exit.by,
        time: Math.round((+new Date()) / 1000)
      };


      homeFightExample = homeFightExample || homeRun;

      fights.push(home, away);

    }

    const executionTime = process.hrtime(hrstart)

    console.log(`Game arena completed in ${executionTime}s for ${bot.botid}: ${fights.length} fights`)

    return {
      fights,
      homeFightExample
    }

  },

  /**
   *
   * @param bot
   * @param fights
   * @param homeFightExample
   * @returns {Promise<void>}
   */
  saveBot: async function (bot, fights, homeFightExample) {

    // EDGE CASE per il primo run
    if (fights.length === 0) {
      console.log('Well, no fights, maybe first run.');

      // get league bots,
      const leagueBotsCount = parseInt(await Bots.count({}, LEAGUE_BOTS_TABLE), 10);

      // if 0 add bot anyway
      if (leagueBotsCount === 0) {
        return await Bots.add({
          botid: bot.botid,
          source: bot.source,
          // prendo il nome dal primo combattimento,
          // il bot corrente combatte per primo in casa
          name: 'firstBot',
          user: bot.user,
          team: []
        }, LEAGUE_BOTS_TABLE)
      }

      // if 1, update current bot
      if (leagueBotsCount === 1) {
        return await Bots.update(
          {
            botid: bot.botid,
            user: bot.user
          },
          {
            source: bot.source,
            name: 'firstBot',
            team: [],
            timestamp: Math.round((+new Date()) / 1000)
          },
          LEAGUE_BOTS_TABLE
        )
      }

    }

    // controllo che il bot ci sia a db, altrimenti lo creo
    // caso di send to league come prima azione
    let baseBot = await Bots.one({botid: bot.botid, user: bot.user});

    const botName = fights[0].history.players[0].name;
    const botTeam = homeFightExample.players[0].troop.map(s => s.type);

    if (!baseBot) {
      // add to bots
      baseBot = await Bots.add({
        botid: bot.botid,
        source: bot.source,
        name: botName,
        user: bot.user,
        team: botTeam
      })
    } else {
      baseBot = await Bots.update(
        {
          botid: bot.botid,
          user: bot.user
        },
        {
          source: bot.source,
          name: botName,
          team: botTeam
        }
      );
    }

    // controllo che esista in league
    const leagueBot = await Bots.one({botid: baseBot.botid, user: baseBot.user}, LEAGUE_BOTS_TABLE)

    if (leagueBot) {
      // update in league
      await Bots.update(
        {
          botid: leagueBot.botid,
          user: leagueBot.user
        },
        {
          source: baseBot.source,
          name: botName,
          team: botTeam,
          timestamp: Math.round((+new Date()) / 1000)
        },
        LEAGUE_BOTS_TABLE
      )
    } else {
      // add to league
      await Bots.add({
        botid: baseBot.botid,
        source: baseBot.source,
        // prendo il nome dal primo combattimento,
        // il bot corrente combatte per primo in casa
        name: botName,
        user: baseBot.user,
        team: botTeam
      }, LEAGUE_BOTS_TABLE)
    }
  }

};

module.exports = GameArena;
