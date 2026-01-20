import { world } from "@minecraft/server";
import {
  REGISTRY_ENTITY_ID,
  TAG_REGISTRY,
  CN_DEF_PREFIX,
  CN_IN_PREFIX,
  CN_OUT_PREFIX,
} from "../../config/constants";

// -----------------------------------------------------
// Single global registry entity (1 armor stand) stores
// all networks + mappings as tags.
//
// Agora suporta:
// - Senha por rede (opcional)
// - Deletar/editar rede (com migração de netId)
// - Remover uma rede limpa todos os vínculos
// -----------------------------------------------------

function findRegistry(overworld) {
  const ents = overworld.getEntities({ tags: [TAG_REGISTRY] });
  for (const e of ents) return e;
  return null;
}

export function ensureRegistry() {
  const overworld = world.getDimension("overworld");
  let reg = findRegistry(overworld);
  if (reg) return reg;

  reg = overworld.spawnEntity(REGISTRY_ENTITY_ID, { x: 0.5, y: 1.0, z: 0.5 });
  try { reg.addTag(TAG_REGISTRY); } catch {}
  try { reg.nameTag = ""; } catch {}
  // best-effort invisibility (if not allowed, ignore)
  try { reg.addEffect("invisibility", 999999, { amplifier: 1, showParticles: false }); } catch {}
  return reg;
}

export function blockKey(block) {
  const dimId = block.dimension.id;
  const { x, y, z } = block.location;
  return `${dimId}|${x}|${y}|${z}`;
}

export function parseKey(key) {
  const parts = String(key).split("|");
  if (parts.length !== 4) return null;
  const [dimId, xs, ys, zs] = parts;
  const x = Number(xs), y = Number(ys), z = Number(zs);
  if (![x, y, z].every((n) => Number.isFinite(n))) return null;
  return { dimId, x, y, z };
}

// ---------------- Networks ----------------
function safeField(s) {
  // tags use "|" as delimiter
  return String(s ?? "").replace(/\|/g, " ").trim();
}

function encodePwd(pwd) {
  const p = String(pwd ?? "").trim();
  if (!p) return "";
  // encode to be safe inside a tag (avoid pipes)
  return encodeURIComponent(p);
}

function decodePwd(enc) {
  const e = String(enc ?? "").trim();
  if (!e) return "";
  try { return decodeURIComponent(e); } catch { return e; }
}

function parseNetworkDefTag(tag) {
  if (!String(tag).startsWith(CN_DEF_PREFIX)) return null;
  const raw = String(tag).substring(CN_DEF_PREFIX.length);
  const parts = raw.split("|");
  if (parts.length < 3) return null;
  const netId = parts[0];
  const displayName = parts[1];
  const colorId = parts[2];

  let password = "";
  if (parts.length >= 4) {
    const p4 = String(parts[3] ?? "");
    if (p4.startsWith("p=")) password = decodePwd(p4.substring(2));
  }
  return { netId, displayName, colorId, password };
}

function buildNetworkDefTag(netId, displayName, colorId, password) {
  const name = safeField(displayName);
  const color = safeField(colorId);
  const pwdEnc = encodePwd(password);
  if (pwdEnc) return `${CN_DEF_PREFIX}${netId}|${name}|${color}|p=${pwdEnc}`;
  return `${CN_DEF_PREFIX}${netId}|${name}|${color}`;
}

export function getAllNetworks(registry) {
  const out = [];
  for (const t of registry.getTags()) {
    const def = parseNetworkDefTag(t);
    if (!def) continue;
    out.push(def);
  }
  out.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
  return out;
}

export function getNetworkById(registry, netId) {
  // Be robust against older versions that may have left duplicated tags.
  // Prefer the *last* matching tag (newest) and accept both "<prefix><id>|" and "<prefix><id>".
  const p1 = `${CN_DEF_PREFIX}${netId}|`;
  const p2 = `${CN_DEF_PREFIX}${netId}`;
  let found = null;
  for (const t of registry.getTags()) {
    if (t.startsWith(p1) || t === p2 || t.startsWith(p2 + "|")) {
      const def = parseNetworkDefTag(t);
      if (def) found = def;
    }
  }
  return found;
}

export function networkHasPassword(registry, netId) {
  const def = getNetworkById(registry, netId);
  return !!(def && String(def.password ?? "").trim());
}

export function verifyNetworkPassword(registry, netId, passwordAttempt) {
  const def = getNetworkById(registry, netId);
  if (!def) return false;
  const real = String(def.password ?? "").trim();
  if (!real) return true; // no password => always ok
  return String(passwordAttempt ?? "").trim() === real;
}

export function upsertNetworkDef(registry, netId, displayName, colorId, password) {
  const p1 = `${CN_DEF_PREFIX}${netId}|`;
  const p2 = `${CN_DEF_PREFIX}${netId}`;
  for (const t of registry.getTags()) {
    if (t.startsWith(p1) || t === p2 || t.startsWith(p2 + "|")) {
      try { registry.removeTag(t); } catch {}
    }
  }
  try {
    registry.addTag(buildNetworkDefTag(netId, displayName, colorId, password));
  } catch {}
}

export function removeNetworkDef(registry, netId) {
  const p1 = `${CN_DEF_PREFIX}${netId}|`;
  const p2 = `${CN_DEF_PREFIX}${netId}`;
  for (const t of registry.getTags()) {
    if (t.startsWith(p1) || t === p2 || t.startsWith(p2 + "|")) {
      try { registry.removeTag(t); } catch {}
    }
  }
}

function migrateNetIdInMappings(registry, prefix, oldNetId, newNetId) {
  // prefix is CN_IN_PREFIX or CN_OUT_PREFIX
  const toChange = [];
  for (const t of registry.getTags()) {
    if (!t.startsWith(prefix)) continue;
    const raw = t.substring(prefix.length);
    const idx = raw.lastIndexOf("|");
    if (idx <= 0) continue;
    const chestKey = raw.substring(0, idx);
    const netId = raw.substring(idx + 1);
    if (netId !== oldNetId) continue;
    toChange.push({ oldTag: t, newTag: `${prefix}${chestKey}|${newNetId}` });
  }
  for (const ch of toChange) {
    try { registry.removeTag(ch.oldTag); } catch {}
    try { registry.addTag(ch.newTag); } catch {}
  }
}

export function migrateNetworkId(registry, oldNetId, newNetId) {
  if (!oldNetId || !newNetId || oldNetId === newNetId) return;
  migrateNetIdInMappings(registry, CN_IN_PREFIX, oldNetId, newNetId);
  migrateNetIdInMappings(registry, CN_OUT_PREFIX, oldNetId, newNetId);
}

export function removeAllMappingsForNet(registry, netId) {
  const toRemove = [];
  for (const t of registry.getTags()) {
    if (t.startsWith(CN_IN_PREFIX) || t.startsWith(CN_OUT_PREFIX)) {
      const raw = t.startsWith(CN_IN_PREFIX)
        ? t.substring(CN_IN_PREFIX.length)
        : t.substring(CN_OUT_PREFIX.length);

      const idx = raw.lastIndexOf("|");
      if (idx <= 0) continue;
      const id = raw.substring(idx + 1);
      if (id === netId) toRemove.push(t);
    }
  }
  for (const t of toRemove) {
    try { registry.removeTag(t); } catch {}
  }
}

export function deleteNetwork(registry, netId) {
  // remove def + all mappings
  removeAllMappingsForNet(registry, netId);
  removeNetworkDef(registry, netId);
}

// ---------------- Inputs ----------------
function clearInputTagsFor(registry, chestKey) {
  const prefix = `${CN_IN_PREFIX}${chestKey}|`;
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) {
      try { registry.removeTag(t); } catch {}
    }
  }
}

// EXPORT: remove input mapping (tirar da rede)
export function removeChestInput(registry, chestKey) {
  clearInputTagsFor(registry, chestKey);
}

export function setChestAsInput(registry, chestKey, netId) {
  // TRAVA: se virar entrada, não pode ser saída ao mesmo tempo
  clearChestOutputs(registry, chestKey);

  // remove input anterior e set novo
  clearInputTagsFor(registry, chestKey);
  try { registry.addTag(`${CN_IN_PREFIX}${chestKey}|${netId}`); } catch {}
}

export function getChestInputNetId(registry, chestKey) {
  const prefix = `${CN_IN_PREFIX}${chestKey}|`;
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) return t.substring(prefix.length);
  }
  return null;
}

export function getInputsByNet(registry) {
  // map netId -> [chestKey]
  const map = new Map();
  for (const t of registry.getTags()) {
    if (!t.startsWith(CN_IN_PREFIX)) continue;
    const raw = t.substring(CN_IN_PREFIX.length);
    const idx = raw.lastIndexOf("|");
    if (idx <= 0) continue;
    const chestKey = raw.substring(0, idx);
    const netId = raw.substring(idx + 1);
    if (!map.has(netId)) map.set(netId, []);
    map.get(netId).push(chestKey);
  }
  return map;
}

// ---------------- Outputs (subscriptions) ----------------
export function getChestOutputNetIds(registry, chestKey) {
  const prefix = `${CN_OUT_PREFIX}${chestKey}|`;
  const ids = [];
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) ids.push(t.substring(prefix.length));
  }
  return Array.from(new Set(ids));
}

export function addChestOutput(registry, chestKey, netId) {
  // TRAVA: se virar saída, não pode ser entrada ao mesmo tempo
  removeChestInput(registry, chestKey);

  try { registry.addTag(`${CN_OUT_PREFIX}${chestKey}|${netId}`); } catch {}
}

export function removeChestOutput(registry, chestKey, netId) {
  const tag = `${CN_OUT_PREFIX}${chestKey}|${netId}`;
  try { registry.removeTag(tag); } catch {}
}

export function clearChestOutputs(registry, chestKey) {
  const prefix = `${CN_OUT_PREFIX}${chestKey}|`;
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) {
      try { registry.removeTag(t); } catch {}
    }
  }
}

export function getOutputsByNet(registry) {
  // map netId -> [chestKey]
  const map = new Map();
  for (const t of registry.getTags()) {
    if (!t.startsWith(CN_OUT_PREFIX)) continue;
    const raw = t.substring(CN_OUT_PREFIX.length);
    const idx = raw.lastIndexOf("|");
    if (idx <= 0) continue;
    const chestKey = raw.substring(0, idx);
    const netId = raw.substring(idx + 1);
    if (!map.has(netId)) map.set(netId, []);
    map.get(netId).push(chestKey);
  }
  return map;
}
