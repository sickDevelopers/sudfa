
function Soldier(game, options) {

    const id = Math.random().toString(36).substring(2);
    const type = options.type;
    const name = options.name || options.type;
    const motto = options.motto || "Random quote";
    
    let health = 0;
    let attack = 0;
    let magicPower = 0;
    let maxHealth = 0;
    let status = 'OK';
    
    switch (options.type) {
        case 'dev':
            health = maxHealth = 12;
            attack = 3;
            break;
        case 'pm':
            health = maxHealth =  10;
            attack = 2;
            healPower = 4;
            break;
        case 'mktg':
            health = maxHealth =  6;
            attack = 1;
            // healPower = 1;
            magicPower = 2;
            break;
        default:
            throw new Error('Invalid soldier type')
    }

    const hit = (target) => {
        doAction.call(this, 'hit', target)
    }

    const heal = (target) => {
        doAction.call(this, 'heal', target)
    }

    const cast = () => {
        doAction.call(this, 'cast')
    }

    const canHeal = () => {
        return type === 'pm';
    }

    const canCast = () => {
        return type === 'mktg';
    }

    const doAction = (actionType, target) => {

        let success = false;
        let message = '';

        if (game.currentPlayer.actionDone) {
            throw new Error('You can do only one action per turn');
        }

        // HIT
        if (actionType === 'hit') {
            const aliveOpponents = game.getAliveTroops(game.opponentPlayer.team);
            const t = aliveOpponents.find(soldier => soldier.getId() === target.getId());

            
            t.setHealth(t.getHealth() - attack);
            
            message = `${name} attacks ${t.getName()} - ${attack} damage`
            console.log(message)
            success = true;
        }

        // HEAL 
        if (actionType === 'heal') {
            if (canHeal()) {
                const aliveCompanions = game.getAliveTroops(game.currentPlayer.team);
                const t = aliveCompanions.find(soldier => soldier.getId() === target.getId());
    
                if (!t) {
                    message = `${name} trying to heal: invalid target`;
                    success = false;
                } else {
                    message = `${name} heals companion ${t.getName()}`;
                    t.setHealth(Math.min( maxHealth,  t.getHealth() + healPower ))
                    success = true;
                }

            } else {
                message `${name} can't heal, sorry! You lost an action!`;
                success = false;
            }
            console.log(message);
        }

        // CAST 
        if (actionType === 'cast') {
            if (canCast()) {
                const aliveOpponents = game.getAliveTroops(game.opponentPlayer.team);
    
                message = `${name} cast on all enemies`;

                aliveOpponents.forEach(opponent => {
                    opponent.setHealth(opponent.getHealth() - magicPower)
                })

                success = true;
            } else {
                message = `${name} can't cast, sorry! You lost an action!`;
                success = false;
            }
            console.log(message);
        }

        game.currentPlayer.actionDone = {
            actor: id,
            type: actionType,
            target: target ? target.getId() : null,
            success,
            message
        };
    }

    // getters
    const getId = () => id;
    const getHealth = () => health;
    const getAttack = () => attack;
    const getName = () => name;
    const getType = () => type;
    const getMotto = () => motto;
    const getMaxHealth = () => maxHealth;
    const getStatus = () => health <= 0 ? 'DEAD' : (status ? status : 'OK')

    // setters
    const setHealth = value => {
        health = Math.min(maxHealth, value);
    }

    const info = () => ({
        id,
        name,
        motto,
        health,
        attack,
        maxHealth,
        magicPower,
        healPower
    })


    return {
        hit,
        heal,
        cast,
        canHeal,
        canCast,
        // getters
        info,
        getMotto,
        getType,
        getHealth,
        getAttack,
        getName,
        getId,
        getMaxHealth,
        getStatus,
        // setters
        setHealth
    }

}

module.exports = Soldier;