import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  WRENCH_ID,
  HOPPER_ID,
  ENDER_HOPPER_MAX_RANGE,
  VACUUM_ENTITY_ID,
  TAG_VACUUM,
  TAG_VACUUM_KEY_PREFIX,
  TAG_RANGE_PREFIX,
  REGISTRY_ENTITY_ID,
  TAG_REGISTRY,
  TAG_ACTIVE_PREFIX,
} from "../config/constants";

// Wrench (Utilities): only the Vacuum Hopper config lives here.
// Chest Network is implemented in its own module: utilities/chest_net/*

const COOLDOWN_TICKS = 8;
const cooldown = new Map();

// Local tick counter (do not depend on system.currentTick)
let TICK = 0;
system.runInterval(() => {
  TICK++;
}, 1);

function isSneaking(player) {
  try {
    const v = player?.isSneaking;
    if (typeof v === "boolean") return v;
    if (typeof v === "function") return !!v.call(player);
  } catch {}
  return false;
}

function playerKey(player) {
  return player?.id ?? player?.name ?? "unknown";
}

function blockKey(block) {
  const dimId = block.dimension.id;
  const { x, y, z } = block.location;
  return `${dimId}|${x}|${y}|${z}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// =====================================================
// Global registry entity (single DB)
// =====================================================
function findRegistry(overworld) {
  const ents = overworld.getEntities({ tags: [TAG_REGISTRY] });
  for (const e of ents) return e;
  return null;
}

function ensureRegistry(overworld) {
  let reg = findRegistry(overworld);
  if (reg) return reg;

  reg = overworld.spawnEntity(REGISTRY_ENTITY_ID, { x: 0.5, y: 1.0, z: 0.5 });
  try {
    reg.addTag(TAG_REGISTRY);
  } catch {}
  try {
    reg.nameTag = "";
  } catch {}
  // best-effort invisibility
  try {
    reg.addEffect("invisibility", 999999, { amplifier: 1, showParticles: false });
  } catch {}
  return reg;
}

function getRegistry() {
  // store registry in overworld
  return ensureRegistry(world.getDimension("overworld"));
}

// =====================================================
// Vacuum Hopper helpers
// =====================================================
function findVacuum(dim, key) {
  const ents = dim.getEntities({ tags: [TAG_VACUUM] });
  for (const e of ents) {
    const tags = e.getTags();
    if (tags.includes(TAG_VACUUM_KEY_PREFIX + key)) return e;
  }
  return null;
}

function getRangeFromVacuum(vac) {
  const tags = vac.getTags();
  const t = tags.find((x) => x.startsWith(TAG_RANGE_PREFIX));
  if (!t) return 0;
  const n = parseInt(t.substring(TAG_RANGE_PREFIX.length), 10);
  return Number.isFinite(n) ? n : 0;
}

function setRangeOnVacuum(vac, range) {
  const tags = vac.getTags();
  for (const t of tags) {
    if (t.startsWith(TAG_RANGE_PREFIX)) {
      try {
        vac.removeTag(t);
      } catch {}
    }
  }
  try {
    vac.addTag(TAG_RANGE_PREFIX + range);
  } catch {}
}

function setVacuumActiveInRegistry(registry, dimId, x, y, z, range) {
  const prefix = `${TAG_ACTIVE_PREFIX}${dimId}|${x}|${y}|${z}|`;
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) {
      try {
        registry.removeTag(t);
      } catch {}
    }
  }
  try {
    registry.addTag(`${TAG_ACTIVE_PREFIX}${dimId}|${x}|${y}|${z}|${range}`);
  } catch {}
}

function setVacuumInactiveInRegistry(registry, dimId, x, y, z) {
  const prefix = `${TAG_ACTIVE_PREFIX}${dimId}|${x}|${y}|${z}|`;
  for (const t of registry.getTags()) {
    if (t.startsWith(prefix)) {
      try {
        registry.removeTag(t);
      } catch {}
    }
  }
}

function spawnVacuum(dim, block, key, range) {
  const { x, y, z } = block.location;
  const center = { x: x + 0.5, y: y + 1.0, z: z + 0.5 };

  const vac = dim.spawnEntity(VACUUM_ENTITY_ID, center);
  try {
    vac.addTag(TAG_VACUUM);
  } catch {}
  try {
    vac.addTag(TAG_VACUUM_KEY_PREFIX + key);
  } catch {}
  try {
    vac.addTag(TAG_RANGE_PREFIX + range);
  } catch {}
  try {
    vac.nameTag = "";
  } catch {}
  try {
    vac.addEffect("invisibility", 999999, { amplifier: 1, showParticles: false });
  } catch {}
  return vac;
}

function openVacuumUI(player, enabled, range) {
  const form = new ModalFormData()
    .title("Vacuum Hopper")
    .toggle("Ativar Vacuum", !!enabled)
    .slider("Range", 0, ENDER_HOPPER_MAX_RANGE, 1, range);
  return form.show(player);
}

async function handleHopperConfig(player, block) {
  const dim = block.dimension;
  const key = blockKey(block);

  const existing = findVacuum(dim, key);
  const enabled = !!existing;
  const currentRange = existing ? getRangeFromVacuum(existing) : 8;

  const res = await openVacuumUI(player, enabled, currentRange);
  if (res.canceled) return;

  const [newEnabled, newRangeRaw] = res.formValues;
  const newRange = clamp(Number(newRangeRaw) || 0, 0, ENDER_HOPPER_MAX_RANGE);

  const registry = getRegistry();
  const dimId = block.dimension.id;
  const { x, y, z } = block.location;

  const nowVac = findVacuum(dim, key);
  if (!newEnabled || newRange <= 0) {
    setVacuumInactiveInRegistry(registry, dimId, x, y, z);
    if (nowVac) {
      try {
        nowVac.remove();
      } catch {}
    }
    return;
  }

  setVacuumActiveInRegistry(registry, dimId, x, y, z, newRange);
  if (nowVac) {
    setRangeOnVacuum(nowVac, newRange);
    return;
  }

  spawnVacuum(dim, block, key, newRange);
}

// =====================================================
// Event
// =====================================================
world.beforeEvents.itemUseOn.subscribe((ev) => {
  const player = ev?.source;
  const block = ev?.block;
  const item = ev?.itemStack;

  if (!player || !block || !item) return;
  if (item.typeId !== WRENCH_ID) return;
  if (!isSneaking(player)) return;

  // Only the hopper config is handled here.
  if (block.typeId !== HOPPER_ID) return;

  const pk = playerKey(player);
  const last = cooldown.get(pk) ?? -999999;
  if (TICK - last < COOLDOWN_TICKS) {
    try {
      ev.cancel = true;
    } catch {}
    return;
  }
  cooldown.set(pk, TICK);

  try {
    ev.cancel = true;
  } catch {}

  system.run(() => {
    handleHopperConfig(player, block).catch(() => {});
  });
});
