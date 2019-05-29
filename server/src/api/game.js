const {jwtCheck} = require('./auth');
const GameArena = require('../engine/game-arena');
const Bot = require('../model/bot');
const League = require('../model/league');
const GameQueue = require('../engine/game-queue');
const Queue = require('../model/queue');
const Fight = require('../model/fight');
const fs = require('fs');

const queue = GameQueue.getInstance();

class GameApi {

  constructor(app) {


    app.get('/fights', (req, res) => {

      const bots = req.query.bots;
      const against = req.query.against;

      Fight.ofBotsAgainst(bots.split(','), against)
        .then(fights => {

          res.json(fights.map(f => {
            delete f.history;
            delete f.time;
            return f;
          }))
        })
        .catch(err => {
          console.error(err);
          res.status(500).send(err);
        })

    });

    /**
     *
     */
    app.post('/source', jwtCheck, (req, res) => {


      const userId = req.user.sub;
      const botid = req.body.bot;
      let code = req.body.source;
      const level = req.body.level;
      const challenge = req.body.challenge;

      code = code.replace('/n', '');
      code = code.replace('/r', '');

      // CHALLENGE A USER BOT
      if (challenge) {
        const fightParams = {
          userId,
          botid,
          code,
          challenge
        };
        return GameArena.singleChallengeFight(fightParams)
          .then(gameHistory => {
            res.json(gameHistory)
          })
          .catch(error => {
            console.error(error);
            res.send(error)
          })

      }

      const fightParams = {
        userId,
        botid,
        level,
        code
      };

      return GameArena.singleBotFight(fightParams)
        .then(gameHistory => {
          res.json(gameHistory)
        })
        .catch(error => {
          console.error(error);
          res.send(error)
        })


    });

    /**
     *
     */
    app.post('/league', jwtCheck, (req, res) => {

      let code = req.body.source;
      code = code.replace('/n', '');
      code = code.replace('/r', '');


      queue.add({
        source: code,
        botid: req.body.botid,
        user: req.user.sub
      })
        .then(response => {
          res.json(response)
        })
        .catch(error => {
          console.error(error);
          res.status(500).send({error: error});
        })

    });

    app.get('/leaderboard', (req, res) => {
      res.json(JSON.parse(League.leaderboard()))
    });

    app.get('/fight/:bot1/:bot2', (req, res) => {

      Promise.all([
        Bot.one({botid: req.params.bot1}, 'league_bots'),
        Bot.one({botid: req.params.bot2}, 'league_bots'),
        Fight.one({
          bot1: req.params.bot1,
          bot2: req.params.bot2
        }),
        Fight.one({
          bot1: req.params.bot2,
          bot2: req.params.bot1
        }),
      ])
        .then(results => {

          res.json({
            bots: [results[0], results[1]],
            fights: [results[2], results[3]]
          })


        })
        .catch(err => {
          console.error(err);
          res.status(500).send(err)
        })

    });

    app.get('/API', (req, res) => {
      res.send(fs.readFileSync('./src/API.md').toString());
    });

    app.get('/queue/:botid', jwtCheck, (req, res) => {
console.log('QUEUE REQEST');
      console.log("req.params.botid", req.params.botid);
      console.log("req.user.sub", req.user.sub);

      Queue.one({
        user: req.user.sub,
        botid: req.params.botid
      })
        .then(queueEl => {

          console.log('GOT QUEUE EL', queueEl);

          if (queueEl) {

            if (queueEl.status === 'started') {
              res.send(queueEl)
            }

            if (queueEl.status === 'fail') {
              res.send({
                exit: 'KO'
              })
            }

          } else {
            res.send({
              exit: 'OK'
            })
          }
        })

    });

    app.get('/rerun', (req, res) => {
      GameArena.rerun()
        .then(response => {
          res.json(response)
        })
        .catch(error => {
          console.error(error);
          res.status(500).send({error: error});
        })
    })

  }

}

module.exports = (function () {

  let instance = null;

  const getInstance = function (app) {
    if (!instance) {
      instance = new GameApi(app);
    }
    return instance;
  };

  return {
    getInstance
  }

}());
