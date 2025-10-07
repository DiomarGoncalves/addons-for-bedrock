import { world } from '@minecraft/server';

export class BanManager {
    constructor() {
        this.bannedPlayersKey = 'banned_players';
        this.initializeBanList();
    }

    initializeBanList() {
        const banned = world.getDynamicProperty(this.bannedPlayersKey);
        if (!banned) {
            world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify([]));
        }
    }

    getBannedPlayers() {
        try {
            const banned = world.getDynamicProperty(this.bannedPlayersKey);
            return banned ? JSON.parse(banned) : [];
        } catch {
            return [];
        }
    }

    isBanned(playerName) {
        const bannedList = this.getBannedPlayers();
        return bannedList.some(entry =>
            entry.name.toLowerCase() === playerName.toLowerCase()
        );
    }

    banPlayer(player, admin) {
        const bannedList = this.getBannedPlayers();

        if (this.isBanned(player.name)) {
            admin.sendMessage(`§8[admin panel] ${player.name} já está banido!`);
            return false;
        }

        bannedList.push({
            name: player.name,
            bannedBy: admin.name,
            date: new Date().toISOString()
        });

        world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify(bannedList));

        world.sendMessage(`§8[admin panel] ${player.name} foi banido por ${admin.name}!`);

        try {
            player.runCommand(`kick "${player.name}" §cVocê foi banido deste servidor!`);
        } catch (error) {
            console.warn(`Erro ao kickar jogador banido: ${error}`);
        }

        return true;
    }

    unbanPlayer(playerName) {
        const bannedList = this.getBannedPlayers();
        const newList = bannedList.filter(entry =>
            entry.name.toLowerCase() !== playerName.toLowerCase()
        );

        if (bannedList.length === newList.length) {
            return false;
        }

        world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify(newList));
        world.sendMessage(`§8[admin panel] ${playerName} foi desbanido!`);

        return true;
    }

    getBanInfo(playerName) {
        const bannedList = this.getBannedPlayers();
        return bannedList.find(entry =>
            entry.name.toLowerCase() === playerName.toLowerCase()
        );
    }
}
