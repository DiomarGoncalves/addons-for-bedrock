import { world } from "@minecraft/server";
import {
  CN_DEF_PREFIX,
  CN_IN_PREFIX,
  CN_OUT_PREFIX,
  CN_DEF_PREFIX_OLD,
  CN_IN_PREFIX_OLD,
  CN_OUT_PREFIX_OLD,
} from "../../config/constants";

// -----------------------------------------------------
// Chest Network Registry (SEM ARMOR STAND)
// -----------------------------------------------------
// Motivo:
// - Armor stands (registry) somem quando chunk descarrega.
// - Aí ensureRegistry() não encontra e cria outro perto do player,
//   gerando "enxame" de armor stand e quebrando o addon.
//
// Solução:
// - Armazenar tudo em Dynamic Property do mundo (JSON).
// - Não depende de chunk carregado.
// - Sem spawn/teleport de entidade.
// -----------------------------------------------------

const DP_CHEST_NET = "us_chest_net_v1";

function readData() {
  const raw = world.getDynamicProperty(DP_CHEST_NET);
  if (!raw) return { networks: {}, inputs: {}, outputs: {} };
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return { networks: {}, inputs: {}, outputs: {} };
    return {
      networks: obj.networks && typeof obj.networks === "object" ? obj.networks : {},
      inputs: obj.inputs && typeof obj.inputs === "object" ? obj.inputs : {},
      outputs: obj.outputs && typeof obj.outputs === "object" ? obj.outputs : {},
    };
  } catch {
    return { networks: {}, inputs: {}, outputs: {} };
  }
}

function writeData(data) {
  world.setDynamicProperty(DP_CHEST_NET, JSON.stringify(data));
}

function safeField(s) {
  return String(s ?? "").replace(/\|/g, " ").trim();
}

function encodePwd(pwd) {
  const p = String(pwd ?? "").trim();
  if (!p) return "";
  return encodeURIComponent(p);
}

function decodePwd(enc) {
  const e = String(enc ?? "").trim();
  if (!e) return "";
  try { return decodeURIComponent(e); } catch { return e; }
}

export function ensureRegistry(_nearLocation) {
  // Mantido por compatibilidade (calls existentes),
  // mas não cria entidade nenhuma.
  return {};
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
function buildNetworkDefTag(netId, displayName, colorId, password) {
  const name = safeField(displayName);
  const color = safeField(colorId);
  const pwdEnc = encodePwd(password);
  if (pwdEnc) return `${CN_DEF_PREFIX}${netId}|${name}|${color}|p=${pwdEnc}`;
  return `${CN_DEF_PREFIX}${netId}|${name}|${color}`;
}

function parseNetworkDefTag(tag) {
  const s = String(tag);
  let raw = null;
  if (s.startsWith(CN_DEF_PREFIX)) raw = s.substring(CN_DEF_PREFIX.length);
  else if (s.startsWith(CN_DEF_PREFIX_OLD)) raw = s.substring(CN_DEF_PREFIX_OLD.length);
  else return null;

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

export function getAllNetworks(_registry) {
  const data = readData();
  const out = Object.entries(data.networks).map(([netId, v]) => ({
    netId,
    displayName: String(v?.displayName ?? ""),
    colorId: String(v?.colorId ?? ""),
    password: String(v?.password ?? ""),
  }));
  out.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
  return out;
}

export function getNetworkById(_registry, netId) {
  const data = readData();
  const v = data.networks?.[netId];
  if (!v) return null;
  return {
    netId,
    displayName: String(v.displayName ?? ""),
    colorId: String(v.colorId ?? ""),
    password: String(v.password ?? ""),
  };
}

export function networkHasPassword(registry, netId) {
  const def = getNetworkById(registry, netId);
  return !!(def && String(def.password ?? "").trim());
}

export function verifyNetworkPassword(registry, netId, passwordAttempt) {
  const def = getNetworkById(registry, netId);
  if (!def) return false;
  const real = String(def.password ?? "").trim();
  if (!real) return true;
  return String(passwordAttempt ?? "").trim() === real;
}

export function upsertNetworkDef(_registry, netId, displayName, colorId, password) {
  const data = readData();
  data.networks[netId] = {
    displayName: safeField(displayName),
    colorId: safeField(colorId),
    password: String(password ?? "").trim(),
    tagPreview: buildNetworkDefTag(netId, displayName, colorId, password), // debug/compat
  };
  writeData(data);
}

export function removeNetworkDef(_registry, netId) {
  const data = readData();
  delete data.networks[netId];
  writeData(data);
}

function removeAllMappingsForNet(data, netId) {
  // inputs: chestKey -> netId
  for (const [ck, id] of Object.entries(data.inputs)) {
    if (id === netId) delete data.inputs[ck];
  }
  // outputs: chestKey -> [netId...]
  for (const [ck, arr] of Object.entries(data.outputs)) {
    const next = (Array.isArray(arr) ? arr : []).filter((id) => id !== netId);
    if (next.length === 0) delete data.outputs[ck];
    else data.outputs[ck] = next;
  }
}

export function deleteNetwork(_registry, netId) {
  const data = readData();
  removeAllMappingsForNet(data, netId);
  delete data.networks[netId];
  writeData(data);
}

export function migrateNetworkId(_registry, oldNetId, newNetId) {
  if (!oldNetId || !newNetId || oldNetId === newNetId) return;
  const data = readData();

  // networks
  if (data.networks[oldNetId] && !data.networks[newNetId]) {
    data.networks[newNetId] = data.networks[oldNetId];
  }
  delete data.networks[oldNetId];

  // inputs
  for (const [ck, id] of Object.entries(data.inputs)) {
    if (id === oldNetId) data.inputs[ck] = newNetId;
  }

  // outputs
  for (const [ck, arr] of Object.entries(data.outputs)) {
    if (!Array.isArray(arr)) continue;
    data.outputs[ck] = Array.from(new Set(arr.map((id) => (id === oldNetId ? newNetId : id))));
  }

  writeData(data);
}

// ---------------- Inputs ----------------
export function removeChestInput(_registry, chestKey) {
  const data = readData();
  delete data.inputs[chestKey];
  writeData(data);
}

export function setChestAsInput(_registry, chestKey, netId) {
  const data = readData();

  // TRAVA: se virar entrada, não pode ser saída
  delete data.outputs[chestKey];

  data.inputs[chestKey] = netId;
  writeData(data);
}

export function getChestInputNetId(_registry, chestKey) {
  const data = readData();
  return data.inputs[chestKey] ?? null;
}

export function getInputsByNet(_registry) {
  const data = readData();
  const map = new Map();
  for (const [ck, netId] of Object.entries(data.inputs)) {
    if (!map.has(netId)) map.set(netId, []);
    map.get(netId).push(ck);
  }
  return map;
}

// ---------------- Outputs ----------------
export function getChestOutputNetIds(_registry, chestKey) {
  const data = readData();
  const arr = data.outputs[chestKey];
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.map(String)));
}

export function addChestOutput(_registry, chestKey, netId) {
  const data = readData();

  // TRAVA: se virar saída, não pode ser entrada
  delete data.inputs[chestKey];

  const cur = Array.isArray(data.outputs[chestKey]) ? data.outputs[chestKey] : [];
  data.outputs[chestKey] = Array.from(new Set([...cur, netId]));
  writeData(data);
}

export function removeChestOutput(_registry, chestKey, netId) {
  const data = readData();
  const cur = Array.isArray(data.outputs[chestKey]) ? data.outputs[chestKey] : [];
  const next = cur.filter((id) => id !== netId);
  if (next.length === 0) delete data.outputs[chestKey];
  else data.outputs[chestKey] = next;
  writeData(data);
}

export function clearChestOutputs(_registry, chestKey) {
  const data = readData();
  delete data.outputs[chestKey];
  writeData(data);
}

export function getOutputsByNet(_registry) {
  const data = readData();
  const map = new Map();
  for (const [ck, arr] of Object.entries(data.outputs)) {
    if (!Array.isArray(arr)) continue;
    for (const netId of arr) {
      if (!map.has(netId)) map.set(netId, []);
      map.get(netId).push(ck);
    }
  }
  return map;
}

// Backwards-compat helpers (not used in current code but exported previously)
export function removeNetworkDefLegacy(_registry, netId) { removeNetworkDef(_registry, netId); }
export function upsertNetworkDefLegacy(_registry, netId, displayName, colorId, password) { upsertNetworkDef(_registry, netId, displayName, colorId, password); }
