// banManager.js
import { world } from '@minecraft/server';

export class BanManager {
  constructor() {
    this.bannedPlayersKey = 'banned_players';
    this.initializeBanList();
  }

  initializeBanList() {
    const banned = world.getDynamicProperty(this.bannedPlayersKey);
    if (!banned) world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify([]));
  }

  getBannedPlayers() {
    try {
      const banned = world.getDynamicProperty(this.bannedPlayersKey);
      return banned ? JSON.parse(banned) : [];
    } catch { return []; }
  }

  /** Normaliza entrada (Player, {name}, id-string ou nome-string) */
  #extractTarget(playerOrName) {
    if (!playerOrName) return { id: null, name: null };
    if (typeof playerOrName === 'string') {
      return { id: null, name: playerOrName.trim() };
    }
    // Player real
    const id = playerOrName.id ?? null;
    const name = (playerOrName.name ?? '').trim();
    return { id, name };
  }

  isBanned(playerOrName) {
    const { id, name } = this.#extractTarget(playerOrName);
    const list = this.getBannedPlayers();
    return list.some(e =>
      (id && e?.id && e.id === id) ||
      (!id && e?.name && name && (e.name.toLowerCase() === name.toLowerCase()))
    );
  }

  banPlayer(playerOrName, admin) {
    const { id, name } = this.#extractTarget(playerOrName);
    if (!name) {
      admin?.sendMessage?.('§8[admin panel] alvo inválido para banir.');
      return false;
    }
    if (this.isBanned(playerOrName)) {
      admin?.sendMessage?.(`§8[admin panel] ${name} já está banido!`);
      return false;
    }

    const list = this.getBannedPlayers();
    list.push({
      id: id ?? null,           // << salva o ID quando disponível
      name,
      bannedBy: admin?.name ?? 'sistema',
      date: new Date().toISOString(),
    });
    world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify(list));
    world.sendMessage(`§8[admin panel] ${name} foi banido por ${admin?.name ?? 'sistema'}!`);

    // Tenta kickar
    try {
      if (playerOrName && typeof playerOrName.runCommand === 'function') {
        (playerOrName.runCommandAsync || playerOrName.runCommand).call(
          playerOrName,
          `kick "${name}" §8você foi banido deste servidor!`
        );
      } else {
        const online = world.getPlayers?.() || [];
        const found = online.find(p => p?.id === id || p?.name === name);
        if (found) {
          (found.runCommandAsync || found.runCommand).call(
            found,
            `kick "${name}" §8você foi banido deste servidor!`
          );
        } else if (admin && (admin.runCommandAsync || admin.runCommand)) {
          (admin.runCommandAsync || admin.runCommand).call(
            admin,
            // >>> corrigido: adiciona espaço antes da mensagem <<<
            `kick "${name}" §8você foi banido deste servidor!`
          );
        }
      }
    } catch (error) {
      admin?.sendMessage?.('§8[admin panel] erro ao tentar kickar após banir.');
      console.warn(`Erro ao kickar jogador banido (${name}): ${error}`);
    }

    return true;
  }

  /** Aceita Player, id-string ou nome-string */
  unbanPlayer(playerOrName) {
    const { id, name } = this.#extractTarget(playerOrName);
    const list = this.getBannedPlayers();

    const newList = list.filter(e => {
      const sameId = id && e?.id && e.id === id;
      const sameName = !id && name && e?.name && (e.name.toLowerCase() === name.toLowerCase());
      return !(sameId || sameName);
    });

    if (newList.length === list.length) return false;

    world.setDynamicProperty(this.bannedPlayersKey, JSON.stringify(newList));
    world.sendMessage(`§8[admin panel] ${name || id || 'jogador'} foi desbanido!`);
    return true;
  }

  getBanInfo(playerOrName) {
    const { id, name } = this.#extractTarget(playerOrName);
    const list = this.getBannedPlayers();
    return list.find(e =>
      (id && e?.id && e.id === id) ||
      (!id && name && e?.name && (e.name.toLowerCase() === name.toLowerCase()))
    );
  }
}
