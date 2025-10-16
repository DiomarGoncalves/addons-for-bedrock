import { world } from '@minecraft/server';

export class BanManager {
  constructor() {
    this.objectiveName = 'ban';
    this._ensureObjective();
    // limpa entradas lixo ao iniciar
    this.cleanWeirdParticipants();
  }

  _ensureObjective() {
    const sb = world.scoreboard;
    this._obj = sb.getObjective(this.objectiveName) || sb.addObjective(this.objectiveName, 'banidos');
    return this._obj;
  }
  _objOk() {
    const sb = world.scoreboard;
    this._obj = sb.getObjective(this.objectiveName) || this._ensureObjective();
    return this._obj;
  }
  _exec(cmd, ctx) {
    try {
      const runner = ctx || world.getPlayers()?.[0];
      if (!runner) return false;
      (runner.runCommandAsync || runner.runCommand).call(runner, cmd);
      return true;
    } catch { return false; }
  }

  _safeName(target) {
    try {
      if (!target) return '';
      if (typeof target === 'string') return target.trim();
      if (typeof target.name === 'string' && target.name.trim()) return target.name.trim();
      if (typeof target.nameTag === 'string' && target.nameTag.trim()) return target.nameTag.trim();
      const id = target.scoreboardIdentity;
      if (id?.displayName && typeof id.displayName === 'string') return id.displayName.trim();
    } catch {}
    return String(target ?? '').trim();
  }

  async _hasBanByCmd(name, ctx) {
    try {
      const runner = ctx || world.getPlayers()?.[0];
      if (!runner) return false;
      const res = await runner.runCommandAsync(`scoreboard players get "${name}" ${this.objectiveName}`);
      const out = String(res?.statusMessage ?? '').toLowerCase();
      const m = out.match(/has\s+(-?\d+)\s+for\s+ban/);
      if (!m) return false;
      const val = parseInt(m[1], 10);
      return Number.isFinite(val) && val > 0;
    } catch { return false; }
  }

  cleanWeirdParticipants(ctx) {
    try {
      const obj = this._objOk();
      for (const pid of obj.getParticipants() || []) {
        const nm = String(pid?.displayName ?? '').trim();
        if (!nm || nm.toLowerCase() === '[object object]') {
          const who = nm || String(pid?.id ?? '');
          this._exec(`scoreboard players reset "${who}" ${this.objectiveName}`, ctx);
        }
      }
    } catch {}
  }

  /** lista “confiável”: só quem tem score > 0 E nome válido */
  getBannedPlayers() {
    const obj = this._objOk();
    const out = [];
    for (const id of obj.getParticipants() || []) {
      try {
        const nm = String(id?.displayName ?? '').trim();
        if (!nm || nm.toLowerCase() === '[object object]') continue;
        const s = obj.getScore(id);
        if (typeof s === 'number' && s > 0) out.push({ name: nm, score: s });
      } catch {}
    }
    return out;
  }

  /** checagem rápida (API). No spawn usamos também a confirmação por comando. */
  isBannedQuick(playerOrName) {
    const name = this._safeName(playerOrName);
    if (!name) return false;
    try {
      const obj = this._objOk();
      for (const id of obj.getParticipants() || []) {
        if ((id.displayName || '').toLowerCase() === name.toLowerCase()) {
          const s = obj.getScore(id);
          return typeof s === 'number' && s > 0;
        }
      }
    } catch {}
    return false;
  }

  async banPlayer(playerOrName, admin) {
    const name = this._safeName(playerOrName);
    if (!name) {
      admin?.sendMessage?.('§8[admin painel] alvo inválido para banir.');
      return false;
    }

    // evita duplicar/“travar”: só grava se NÃO estiver banido
    const already = (this.isBannedQuick(name)) || (await this._hasBanByCmd(name, admin));
    if (already) {
      admin?.sendMessage?.(`§8[admin painel] ${name} já está banido!`);
      return false;
    }

    // grava SEMPRE por NOME (comando), nunca por identity
    const ok = this._exec(`scoreboard players set "${name}" ${this.objectiveName} 1`, admin);
    if (!ok) {
      admin?.sendMessage?.('§8[admin painel] falha ao acessar o scoreboard.');
      return false;
    }

    world.sendMessage(`§8[admin painel] ${name} foi banido por ${admin?.name ?? 'sistema'}!`);

    // kicka se o alvo estiver online
    try {
      const online = world.getPlayers() || [];
      const found = online.find(p => p?.name === name || p?.nameTag === name);
      if (found) {
        (found.runCommandAsync || found.runCommand).call(
          found, `kick "${name}" §8você foi banido deste servidor!`
        );
      }
    } catch {}
    return true;
  }

  async unbanPlayer(playerNameOrObj, admin) {
    const name = this._safeName(playerNameOrObj);
    if (!name) return false;

    const ok =
      this._exec(`scoreboard players reset "${name}" ${this.objectiveName}`, admin) ||
      this._exec(`scoreboard players set "${name}" ${this.objectiveName} 0`, admin);
    if (!ok) return false;

    world.sendMessage(`§8[admin painel] ${name} foi desbanido!`);
    return true;
  }

  unbanByAny(fragment, admin) {
    const s = String(fragment ?? '').trim().toLowerCase();
    if (!s) return { removed: 0, remaining: this.getBannedPlayers() };

    const obj = this._objOk();
    let removed = 0;
    for (const id of obj.getParticipants() || []) {
      try {
        const nm = String(id?.displayName ?? '').trim();
        if (!nm || nm.toLowerCase() === '[object object]') continue;
        const sc = obj.getScore(id);
        if (!(typeof sc === 'number' && sc > 0)) continue;
        if (nm.toLowerCase().includes(s)) {
          this._exec(`scoreboard players reset "${nm}" ${this.objectiveName}`, admin);
          removed++;
        }
      } catch {}
    }
    return { removed, remaining: this.getBannedPlayers() };
  }

  getBanInfo(nameOrObj) {
    const name = this._safeName(nameOrObj);
    if (!name) return undefined;
    const obj = this._objOk();
    for (const id of obj.getParticipants() || []) {
      if ((id.displayName || '').toLowerCase() === name.toLowerCase()) {
        const s = obj.getScore(id);
        return { name: id.displayName, score: typeof s === 'number' ? s : undefined };
      }
    }
    return undefined;
  }
}
