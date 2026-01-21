import { world, system } from "@minecraft/server";
import {
  TAG_VACUUM,
  TAG_VACUUM_OLD,
  TAG_VACUUM_KEY_PREFIX,
  TAG_VACUUM_KEY_PREFIX_OLD,
  TAG_RANGE_PREFIX,
  TAG_RANGE_PREFIX_OLD,
  HOPPER_ID,
  ENDER_HOPPER_MAX_RANGE,
  VACUUM_ENTITY_ID,
  DP_ENDER_HOPPER,
  EH_DEBUG,
} from "../config/constants";
import { disableHopperByKey } from "./ender_hopper.storage";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function debug(msg) {
  if (EH_DEBUG) console.warn(`[EnderHopper] ${msg}`);
}

function parseKey(key) {
  const parts = String(key).split("|");
  if (parts.length !== 4) return null;
  const [dimId, xs, ys, zs] = parts;
  const x = Number(xs), y = Number(ys), z = Number(zs);
  if (![x, y, z].every((v) => Number.isFinite(v))) return null;
  return { dimId, x, y, z };
}

function getDimensionById(dimId) {
  const id = String(dimId);
  if (id.endsWith("overworld")) return world.getDimension("overworld");
  if (id.endsWith("nether")) return world.getDimension("nether");
  if (id.endsWith("the_end") || id.endsWith("end")) return world.getDimension("the_end");
  try { return world.getDimension(id); } catch { return null; }
}

function readMap() {
  const raw = world.getDynamicProperty(DP_ENDER_HOPPER);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function findVacuum(dim, key) {
  let ents = [];
  try { ents = dim.getEntities({ type: VACUUM_ENTITY_ID }); } catch { ents = []; }
  for (const e of ents) {
    let tags = [];
    try { tags = e.getTags(); } catch { tags = []; }
    const isVac = tags.includes(TAG_VACUUM) || tags.includes(TAG_VACUUM_OLD);
    if (!isVac) continue;
    if (tags.includes(TAG_VACUUM_KEY_PREFIX + key) || tags.includes(TAG_VACUUM_KEY_PREFIX_OLD + key)) return e;
  }
  return null;
}

function getRange(vac) {
  const tags = vac.getTags();
  const t = tags.find((x) => x.startsWith(TAG_RANGE_PREFIX)) ?? tags.find((x) => x.startsWith(TAG_RANGE_PREFIX_OLD));
  if (!t) return 0;
  const prefix = t.startsWith(TAG_RANGE_PREFIX) ? TAG_RANGE_PREFIX : TAG_RANGE_PREFIX_OLD;
  const n = parseInt(t.substring(prefix.length), 10);
  return Number.isFinite(n) ? n : 0;
}

function setRange(vac, range) {
  const tags = (() => { try { return vac.getTags(); } catch { return []; } })();
  for (const t of tags) {
    if (t.startsWith(TAG_RANGE_PREFIX) || t.startsWith(TAG_RANGE_PREFIX_OLD)) {
      try { vac.removeTag(t); } catch {}
    }
  }
  try { vac.addTag(TAG_RANGE_PREFIX + range); } catch {}
  try { vac.addTag(TAG_RANGE_PREFIX_OLD + range); } catch {}
}

function spawnVacuum(dim, x, y, z, key, range) {
  const center = { x: x + 0.5, y: y + 1.0, z: z + 0.5 };
  const vac = dim.spawnEntity(VACUUM_ENTITY_ID, center);

  try { vac.addTag(TAG_VACUUM); } catch {}
  try { vac.addTag(TAG_VACUUM_OLD); } catch {}
  try { vac.addTag(TAG_VACUUM_KEY_PREFIX + key); } catch {}
  try { vac.addTag(TAG_VACUUM_KEY_PREFIX_OLD + key); } catch {}
  try { vac.addTag(TAG_RANGE_PREFIX + range); } catch {}
  try { vac.addTag(TAG_RANGE_PREFIX_OLD + range); } catch {}

  try { vac.nameTag = ""; } catch {}
  try { vac.addEffect("invisibility", 999999, { amplifier: 1, showParticles: false }); } catch {}

  return vac;
}

// =====================================================
// Loop: puxa itens para hoppers ativos (config em DynamicProperty)
// - ZERO armor-stand registry (evita multiplicação / "teleporte" pro player)
// - Só processa o que está carregado no tick atual
// =====================================================
system.runInterval(() => {
  const map = readMap();
  const entries = Object.entries(map);

  if (!entries.length) return;

  for (const [key, cfg] of entries) {
    try {
      if (!cfg || typeof cfg !== "object") continue;
      if (!cfg.enabled) continue;

      const parsed = parseKey(key);
      if (!parsed) continue;

      const dim = getDimensionById(parsed.dimId);
      if (!dim) continue;

      // Se o chunk do hopper não estiver carregado, getBlock pode falhar → ignora (não cria nada)
      let hopper;
      try { hopper = dim.getBlock({ x: parsed.x, y: parsed.y, z: parsed.z }); }
      catch { hopper = null; }

      if (!hopper || hopper.typeId !== HOPPER_ID) {
        // Hopper removido → desativa config
        disableHopperByKey(key);
        continue;
      }

      const range = clamp(Number(cfg.range) || 0, 0, ENDER_HOPPER_MAX_RANGE);
      if (range <= 0) continue;

      // Vacuum marker por hopper (fixo no topo do hopper)
      let vac = findVacuum(dim, key);
      if (!vac) {
        try { vac = spawnVacuum(dim, parsed.x, parsed.y, parsed.z, key, range); }
        catch { vac = null; }
      }
      if (!vac) continue;

      // garante range tag atual
      const vr = getRange(vac);
      if (vr !== range) setRange(vac, range);

      // mantém o vacuum em cima do hopper (NÃO vai pro player)
      const center = { x: parsed.x + 0.5, y: parsed.y + 1.0, z: parsed.z + 0.5 };
      try { vac.teleport(center); } catch {}

      // puxa itens (distância 3D)
      let items = [];
      try { items = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: range }); }
      catch { items = []; }

      for (const it of items) {
        try {
          // topo do hopper (pra ser engolido)
          it.teleport({ x: parsed.x + 0.5, y: parsed.y + 1.1, z: parsed.z + 0.5 });
        } catch {}
      }
    } catch (e) {
      debug(String(e));
    }
  }
}, 10);
