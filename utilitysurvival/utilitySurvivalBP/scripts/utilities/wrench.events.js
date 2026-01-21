import { world, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  WRENCH_ID,
  HOPPER_ID,
  ENDER_HOPPER_MAX_RANGE,
  VACUUM_ENTITY_ID,
  TAG_VACUUM,
  TAG_VACUUM_OLD,
  TAG_VACUUM_KEY_PREFIX,
  TAG_VACUUM_KEY_PREFIX_OLD,
  TAG_RANGE_PREFIX,
  TAG_RANGE_PREFIX_OLD,
  EH_DEBUG,
} from "../config/constants";
import { getHopperConfig, saveHopperConfig, getKeyFromCoords } from "./ender_hopper.storage";

// =====================================================
// Wrench (Utilities)
// - Configura o Ender/Vacuum Hopper (range + enable)
// - NÃO abre UI de ChestNet aqui
// - NÃO usa registry em armor-stand (evita multiplicação / "teleporte" pro player)
// =====================================================

const COOLDOWN_TICKS = 8;
const cooldown = new Map();

// Local tick counter (do not depend on system.currentTick)
let TICK = 0;
system.runInterval(() => { TICK++; }, 1);

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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

function getRangeFromVacuum(vac) {
  const tags = vac.getTags();
  const t = tags.find((x) => x.startsWith(TAG_RANGE_PREFIX)) ?? tags.find((x) => x.startsWith(TAG_RANGE_PREFIX_OLD));
  if (!t) return 0;
  const prefix = t.startsWith(TAG_RANGE_PREFIX) ? TAG_RANGE_PREFIX : TAG_RANGE_PREFIX_OLD;
  const n = parseInt(t.substring(prefix.length), 10);
  return Number.isFinite(n) ? n : 0;
}

function openHopperUI(player, enabled, range) {
  const form = new ModalFormData()
    .title("Ender Hopper")
    .toggle("Ativar puxar itens", !!enabled)
    .slider("Alcance (blocos)", 0, ENDER_HOPPER_MAX_RANGE, 1, clamp(range, 0, ENDER_HOPPER_MAX_RANGE));
  return form.show(player);
}

async function handleHopperConfig(player, block) {
  const cfg = getHopperConfig(block);
  const dim = block.dimension;
  const { x, y, z } = block.location;
  const key = getKeyFromCoords(block.dimension.id, x, y, z);

  // se existir vacuum entity, usa range dela como "fonte da verdade" para UI
  const existing = findVacuum(dim, key);
  const currentRange = existing ? getRangeFromVacuum(existing) : (Number(cfg.range) || 8);
  const enabled = existing ? true : !!cfg.enabled;

  const res = await openHopperUI(player, enabled, currentRange);
  if (res.canceled) return;

  const [newEnabled, newRangeRaw] = res.formValues;
  const newRange = clamp(Number(newRangeRaw) || 0, 0, ENDER_HOPPER_MAX_RANGE);

  // salva config (DP) — loop do ender_hopper.logic.js lê daqui
  saveHopperConfig(block, { enabled: !!newEnabled, range: newRange });

  // se desativou ou range=0, remove vacuum entity existente
  if (!newEnabled || newRange <= 0) {
    if (existing) {
      try { existing.remove(); } catch {}
    }
  }
}

world.beforeEvents.itemUseOn.subscribe((ev) => {
  const player = ev?.source;
  const block = ev?.block;
  const item = ev?.itemStack;

  if (!player || !block || !item) return;
  if (item.typeId !== WRENCH_ID) return;
  if (!isSneaking(player)) return;

  // só hopper aqui (evita conflito com ChestNet)
  if (block.typeId !== HOPPER_ID) return;

  const pk = playerKey(player);
  const last = cooldown.get(pk) ?? -999999;
  if (TICK - last < COOLDOWN_TICKS) {
    try { ev.cancel = true; } catch {}
    return;
  }
  cooldown.set(pk, TICK);

  try { ev.cancel = true; } catch {}

  system.run(() => {
    handleHopperConfig(player, block).catch((err) => {
      if (EH_DEBUG) console.warn(`[EnderHopper] erro ao abrir UI: ${err}`);
    });
  });
});
