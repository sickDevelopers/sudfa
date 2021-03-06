const Queue = require('../model/queue');
const GameArena = require('./game-arena');

class GameQueue {

  constructor() {
    this.timeout = 0;

    this.tick();
  }

  async tick() {
    // console.log('ticking for arena');
    const firstInQueue = await Queue.first();
    if (firstInQueue) {

      console.log(`Found bot ${firstInQueue.botid} in queue for arena...`)

      await Queue.update({
        botid: firstInQueue.botid,
        user: firstInQueue.user
      }, {
        status: 'started'
      })

      clearTimeout(this.timeout);

      this.startArena(firstInQueue);

    } else {
      this.timeout = setTimeout(() => {
        this.tick();
      }, 1000)
    }
  }

  async startArena(firstInQueue) {
    console.log('START ARENA FOR', firstInQueue.botid);

    try {

      // DEBUG PURPOSE
      // await new Promise(resolve => {
      //   setTimeout(() => resolve(), 5000);
      // })

      // start arena
      const arenaResults = await GameArena.start({
        source: firstInQueue.source,
        botid: firstInQueue.botid,
        user: firstInQueue.user,
        group: firstInQueue.group
      });


      if (arenaResults.exit === 'OK') {
        await Queue.delete({
          botid: firstInQueue.botid
        });
      } else {
        await Queue.update({
          botid: firstInQueue.botid,
          user: firstInQueue.user
        }, {
          status: 'fail'
        })
      }


    } catch (error) {
      console.error(error);

      await Queue.update({
        botid: firstInQueue.botid
      }, {
        status: 'fail'
      })

    }


    // start timeout
    this.tick();
  }

  async add(bot) {
    const {botid, source, user, group} = bot;

    // check if already there
    const botInQueue = await Queue.one({
      botid,
      user
    });

    if (botInQueue) {
      if (botInQueue.status === 'fail') {
        await Queue.delete({
          botid,
          user
        })
      } else {
        throw new Error('Already in queue');
      }
    }

    return Queue.add({
      id: `${(+new Date())}_${user}`,
      botid,
      source,
      user,
      group
    })
  }

}

module.exports = (function () {

  let instance = null;

  const getInstance = () => {
    if (!instance) {
      instance = new GameQueue();
    }
    return instance;
  };

  return {
    getInstance
  }

}());
