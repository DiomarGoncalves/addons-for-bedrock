import { world } from '@minecraft/server';

export class PlayerManager {
    getOnlinePlayers() {
        const players = [];
        for (const player of world.getAllPlayers()) {
            players.push({
                name: player.name,
                id: player.id,
                player: player
            });
        }
        return players;
    }

    getPlayerByName(name) {
        for (const player of world.getAllPlayers()) {
            if (player.name.toLowerCase() === name.toLowerCase()) {
                return player;
            }
        }
        return null;
    }

    kickPlayer(targetPlayer, admin) {
        try {
            world.sendMessage(`§8[admin painel] ${targetPlayer.name} foi expulso por ${admin.name}`);
            targetPlayer.runCommand(`kick "${targetPlayer.name}" §cVocê foi expulso do servidor por um administrador!`);
            return true;
        } catch (error) {
            admin.sendMessage(`§8[admin painel] erro ao expulsar jogador: ${error.message}`);
            return false;
        }
    }

    getPlayerInfo(player) {
        return {
            name: player.name,
            id: player.id,
            location: player.location,
            dimension: player.dimension.id,
            gamemode: this.getGameMode(player),
            health: player.getComponent('minecraft:health')?.currentValue || 0
        };
    }

    getGameMode(player) {
        try {
            if (player.matches({ gameMode: 'survival' })) return 'Survival';
            if (player.matches({ gameMode: 'creative' })) return 'Creative';
            if (player.matches({ gameMode: 'adventure' })) return 'Adventure';
            if (player.matches({ gameMode: 'spectator' })) return 'Spectator';
        } catch {
            return 'Unknown';
        }
        return 'Unknown';
    }
}
