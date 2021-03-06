class Runner {

    constructor(game) {
        // game instance
        this.game = game;
        // team definition
        this.team = {
            name: "Mid Level", 
            troop: [
                game.Mktg({
                    // name: "???",                    
                    // motto: ""
                }),
                game.Pm({
                    
                }),
                game.Dev({
                    
                })
            ]
        }
    }

    
    run() {
        
        // Your current soldier, which is acting in this turn
        const soldier = this.game.getCurrentSoldier();
        // Reference to the enemy team
        const enemyTeam = this.game.getEnemyTeam();
        // Reference to your team
        const myTeam = this.game.getMyTeam();
        
        // Simple AI
        if (soldier.canCast()) {
            // If the soldier can cast, then cast on all enemies
            soldier.cast();
        } else if (soldier.canHeal()) {
            // if the soldier can heal, then heal the most damaged of your team
            const t = myTeam.getMostDamagedSoldier()
            soldier.heal(t);
        } else {
            // make the soldier hit the most damaged enemy
            const target = enemyTeam.getMostDamagedSoldier();
            soldier.hit(target);
        }
        
    }

}

module.exports = Runner;