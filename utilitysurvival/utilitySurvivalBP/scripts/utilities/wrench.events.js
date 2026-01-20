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

  // Registry constants (se não existir no seu constants.js, troque pelos literais abaixo)
  REGISTRY_ENTITY_ID,
  TAG_REGISTRY,
  TAG_ACTIVE_PREFIX,
} from "../config/constants";

// ------------------------------
// Config
// ------------------------------
const COOLDOWN_TICKS = 8;
const cooldown = new Map();

// Tick local (evita depender de system.currentTick)
let TICK = 0;
system.runInterval(() => { TICK++; }, 1);

// ------------------------------
// Helpers
// ------------------------------
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

function hopperKey(block) {
  const dimId = block.dimension.id;
  const { x, y, z } = block.location;
  return `${dimId}|${x}|${y}|${z}`;
}

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
      try { vac.removeTag(t); } catch {}
    }
  }
  try { vac.addTag(TAG_RANGE_PREFIX + range); } catch {}
}

// ------------------------------
// Registry (global state) — Camada 1 (respawn)
// ------------------------------
// Se você não tiver essas exports no constants.js, substitua assim:
// REGISTRY_ENTITY_ID -> "minecraft:armor_stand"
// TAG_REGISTRY -> "eh_registry"
// TAG_ACTIVE_PREFIX -> "eha:"
function findRegistry(overworld) {
  const ents = overworld.getEntities({ tags: [TAG_REGISTRY] });
  for (const e of ents) return e;
  return null;
}

function ensureRegistry(overworld) {
  let reg = findRegistry(overworld);
  if (reg) return reg;

  // cria registry em um ponto fixo
  reg = overworld.spawnEntity(REGISTRY_ENTITY_ID, { x: 0.5, y: 1.0, z: 0.5 });
  try { reg.addTag(TAG_REGISTRY); } catch {}
  try { reg.nameTag = ""; } catch {}
  return reg;
}

function activeTag(dimId, x, y, z, range) {
  return `${TAG_ACTIVE_PREFIX}${dimId}|${x}|${y}|${z}|${range}`;
}

function clearActiveTagsFor(registry, dimId, x, y, z) {
  const tags = registry.getTags();
  const prefix = `${TAG_ACTIVE_PREFIX}${dimId}|${x}|${y}|${z}|`;
  for (const t of tags) {
    if (t.startsWith(prefix)) {
      try { registry.removeTag(t); } catch {}
    }
  }
}

function setActive(registry, dimId, x, y, z, range) {
  clearActiveTagsFor(registry, dimId, x, y, z);
  try { registry.addTag(activeTag(dimId, x, y, z, range)); } catch {}
}

function setInactive(registry, dimId, x, y, z) {
  clearActiveTagsFor(registry, dimId, x, y, z);
}

// ------------------------------
// Vacuum spawn + UI
// ------------------------------
function spawnVacuum(dim, block, key, range) {
  const { x, y, z } = block.location;
  const center = { x: x + 0.5, y: y + 1.0, z: z + 0.5 };

  const vac = dim.spawnEntity(VACUUM_ENTITY_ID, center);

  try { vac.addTag(TAG_VACUUM); } catch {}
  try { vac.addTag(TAG_VACUUM_KEY_PREFIX + key); } catch {}
  try { vac.addTag(TAG_RANGE_PREFIX + range); } catch {}

  // deixa totalmente invisível e “intocável”
  try {
    vac.nameTag = "";
    vac.addEffect("invisibility", 999999, {
      amplifier: 1,
      showParticles: false,
    });
  } catch {}

  return vac;
}

function openConfigUI(player, enabled, range) {
  const form = new ModalFormData()
    .title("Vacuum Hopper")
    .toggle("Ativar Vacuum", !!enabled)
    .slider("Range", 0, ENDER_HOPPER_MAX_RANGE, 1, range);

  return form.show(player);
}

// ------------------------------
// Event
// ------------------------------
world.beforeEvents.itemUseOn.subscribe((ev) => {
  const player = ev?.source;
  const block = ev?.block;
  const item = ev?.itemStack;

  if (!player || !block || !item) return;

  // Só com wrench
  if (item.typeId !== WRENCH_ID) return;

  // Só no hopper
  if (block.typeId !== HOPPER_ID) return;

  // Só com SHIFT (pra não conflitar com UI do hopper)
  if (!isSneaking(player)) return;

  // Cooldown anti multi-disparo
  const pk = playerKey(player);
  const last = cooldown.get(pk) ?? -999999;
  if (TICK - last < COOLDOWN_TICKS) {
    try { ev.cancel = true; } catch {}
    return;
  }
  cooldown.set(pk, TICK);

  // Cancela abrir inventário do hopper
  try { ev.cancel = true; } catch {}

  const dim = block.dimension;
  const key = hopperKey(block);

  // Abre a UI no próximo tick (foge de contexto ruim)
  system.run(() => {
    let existing = null;
    let enabled = false;
    let currentRange = 8;

    try {
      existing = findVacuum(dim, key);
      enabled = !!existing;
      currentRange = existing ? getRangeFromVacuum(existing) : 8;
    } catch {}

    openConfigUI(player, enabled, currentRange)
      .then((res) => {
        if (res.canceled) return;

        const [newEnabled, newRangeRaw] = res.formValues;
        const newRange = Math.max(
          0,
          Math.min(ENDER_HOPPER_MAX_RANGE, Number(newRangeRaw) || 0)
        );

        // Aplica no próximo tick também
        system.run(() => {
          try {
            const nowVac = findVacuum(dim, key);

            const dimId = block.dimension.id;
            const { x, y, z } = block.location;

            // Registry global no overworld
            const registry = ensureRegistry(world.getDimension("overworld"));

            // DESATIVAR
            if (!newEnabled || newRange <= 0) {
              setInactive(registry, dimId, x, y, z);
              if (nowVac) {
                try { nowVac.remove(); } catch {}
              }
              return;
            }

            // ATIVAR / ATUALIZAR
            setActive(registry, dimId, x, y, z, newRange);

            if (nowVac) {
              setRangeOnVacuum(nowVac, newRange);
              return;
            }

            spawnVacuum(dim, block, key, newRange);
          } catch {
            // silencioso (você pediu sem debug)
          }
        });
      })
      .catch(() => {
        // silencioso (se UI falhar por restricted)
      });
  });
});
