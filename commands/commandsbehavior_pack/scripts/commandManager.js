// commandManager.js
// Compatível com @minecraft/server 1.19.0 (sem DynamicPropertiesDefinition)
import { world, system, Player } from "@minecraft/server";

/**
 * Persistência por TAGS do jogador
 * - Armazena o JSON (state.commands) como string chunked em tags:
 *   CPP:0:<chunk>, CPP:1:<chunk>, ...
 * - Limites: tags suportam strings curtas. Para listas grandes, dividimos em pedaços.
 * - Vantagem: tags são persistentes entre /reload e ao reabrir o jogo, sem registrar schema.
 */
const TAG_PREFIX = "CPP:";            // Prefixo das tags de armazenamento
const TAG_KEY = "S";                  // chave principal (pode deixar "S" mesmo)
const CHUNK = 200;                    // tamanho do pedaço por tag (seguro)

// --- Utils de codificação ---
function encodeState(obj) {
  const json = JSON.stringify(obj ?? { commands: [] });
  // sem base64 pra economizar: só particiona
  const chunks = [];
  for (let i = 0; i < json.length; i += CHUNK) {
    chunks.push(json.slice(i, i + CHUNK));
  }
  return chunks;
}

function decodeState(chunks) {
  try {
    const json = chunks.join("");
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.commands)) return parsed;
  } catch { }
  return { commands: [] };
}

// --- Limpa tags antigas ---
function clearStoreTags(player) {
  const all = player.getTags();
  for (const t of all) {
    if (t.startsWith(TAG_PREFIX + TAG_KEY + ":")) {
      player.removeTag(t);
    }
  }
}

// --- Lê do storage (tags) ---
function readStateFromTags(player) {
  const all = player.getTags();
  // Coleta em ordem CPP:S:0:..., CPP:S:1:...
  const parts = [];
  for (let i = 0; ; i++) {
    const prefix = `${TAG_PREFIX}${TAG_KEY}:${i}:`;
    const tag = all.find(t => t.startsWith(prefix));
    if (!tag) break;
    parts.push(tag.slice(prefix.length));
  }
  if (parts.length === 0) return { commands: [] };
  return decodeState(parts);
}

// --- Escreve no storage (tags) ---
function writeStateToTags(player, state) {
  // Remove antiga
  clearStoreTags(player);
  // Particiona e escreve
  const parts = encodeState(state);
  parts.forEach((chunk, i) => {
    player.addTag(`${TAG_PREFIX}${TAG_KEY}:${i}:${chunk}`);
  });
}

// --- (Opcional) Tentativa de leitura de DynamicProperty antiga, se existir ---
const LEGACY_DP_KEY = "cpp_cmds_v1";
function tryReadLegacyDP(player) {
  try {
    const raw = player.getDynamicProperty?.(LEGACY_DP_KEY);
    if (typeof raw === "string" && raw.length) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.commands)) return parsed;
    }
  } catch { }
  return null;
}

// ---------- Camada de persistência unificada ----------
function readState(player) {
  // 1) tenta tags
  const fromTags = readStateFromTags(player);
  if (Array.isArray(fromTags?.commands)) return fromTags;

  // 2) (opcional) tenta legado
  const legacy = tryReadLegacyDP(player);
  if (legacy && Array.isArray(legacy.commands)) return legacy;

  return { commands: [] };
}

function writeState(player, state) {
  writeStateToTags(player, { commands: Array.isArray(state?.commands) ? state.commands : [] });
}

function uid(prefix = "cmd") {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ---------- Execução ----------
async function run(player, cmd) {
  const line = String(cmd || "").trim();
  if (!line) throw new Error("empty-command");
  return player.runCommandAsync(line);
}

// ---------- Repetição ----------
const repeatById = new Map(); // id -> { stop: fn }

function stopRepeat(id) {
  const rec = repeatById.get(id);
  if (!rec) return false;
  try { rec.stop?.(); } catch { }
  repeatById.delete(id);
  return true;
}

// ---------- API pública ----------
export const CommandManager = {
  // CRUD
  getCommands(player) {
    const s = readState(player);
    return s.commands.slice();
  },

  getCommandById(player, id) {
    const s = readState(player);
    return s.commands.find(c => c.id === id) || null;
  },

  addCommand(player, data) {
    const s = readState(player);
    const now = Date.now();
    const payload = {
      id: data?.id || uid("cmd"),
      name: data?.name || "Sem nome",
      type: data?.type || "impulse", // "impulse" | "chain" | "repeat"
      command: data?.command || "",
      delay: Number.isFinite(data?.delay) ? Math.max(1, Math.floor(data.delay)) : 20,
      chainCommands: Array.isArray(data?.chainCommands) ? data.chainCommands : [],
      conditional: !!data?.conditional, // usado por repeat (opcional)
      createdAt: now,
      updatedAt: now,
    };
    s.commands.push(payload);
    writeState(player, s);
    return payload;
  },

  updateCommand(player, id, patch) {
    const s = readState(player);
    const idx = s.commands.findIndex(c => c.id === id);
    if (idx < 0) return null;

    const prev = s.commands[idx];
    const next = {
      ...prev,
      ...patch,
      delay: Number.isFinite(patch?.delay) ? Math.max(1, Math.floor(patch.delay)) : prev.delay,
      chainCommands: Array.isArray(patch?.chainCommands) ? patch.chainCommands : prev.chainCommands,
      conditional: typeof patch?.conditional === "boolean" ? patch.conditional : prev.conditional,
      updatedAt: Date.now(),
    };
    s.commands[idx] = next;
    writeState(player, s);
    return next;
  },

  removeCommand(player, id) {
    stopRepeat(id);
    const s = readState(player);
    s.commands = s.commands.filter(c => c.id !== id);
    writeState(player, s);
    return true;
  },

  // Execução: Impulso
  async executeImpulse(player, command, _conditional = false) {
    try {
      await run(player, command);
      return true;
    } catch {
      return false;
    }
  },

  // Execução: Cadeia
  async executeChain(player, chainCommands = []) {
    let prevOk = true;
    for (const step of (Array.isArray(chainCommands) ? chainCommands : [])) {
      const cmd = String(step?.command || "").trim();
      const cond = !!step?.conditional;
      if (!cmd) continue;
      if (cond && !prevOk) continue;

      try {
        await run(player, cmd);
        prevOk = true;
      } catch {
        prevOk = false;
      }
    }
    return true;
  },

  // Repetição
  isRepeating(id) {
    return repeatById.has(id);
  },

  startRepeatingCommand(player, id, command, delayTicks = 20) {
    stopRepeat(id); // garante único runner
    const dt = Number.isFinite(delayTicks) && delayTicks > 0 ? Math.floor(delayTicks) : 20;

    // Usa system.runInterval se disponível
    if (typeof system?.runInterval === "function") {
      const handle = system.runInterval(() => {
        try { run(player, command).catch(() => { }); } catch { }
      }, dt);
      repeatById.set(id, {
        stop: () => { try { system.clearRun(handle); } catch { } },
      });
      return true;
    }

    // Fallback por tick
    let tick = 0;
    const sub = world.afterEvents.tick.subscribe(() => {
      tick++;
      if (tick >= dt) {
        tick = 0;
        try { run(player, command).catch(() => { }); } catch { }
      }
    });

    repeatById.set(id, {
      stop: () => { try { world.afterEvents.tick.unsubscribe(sub); } catch { } },
    });
    return true;
  },

  stopRepeatingCommand(id) {
    return stopRepeat(id);
  },
};
