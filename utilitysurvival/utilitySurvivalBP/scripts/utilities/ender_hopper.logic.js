import { world, system } from "@minecraft/server";
import {
  TAG_VACUUM,
  TAG_VACUUM_KEY_PREFIX,
  TAG_RANGE_PREFIX,
  HOPPER_ID,
  ENDER_HOPPER_MAX_RANGE,
  VACUUM_ENTITY_ID,
  REGISTRY_ENTITY_ID,
  TAG_REGISTRY,
  TAG_ACTIVE_PREFIX,
} from "../config/constants";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseActiveTag(tag) {
  // eha:dim|x|y|z|range
  if (!tag.startsWith(TAG_ACTIVE_PREFIX)) return null;
  const raw = tag.substring(TAG_ACTIVE_PREFIX.length);
  const parts = raw.split("|");
  if (parts.length !== 5) return null;

  const [dimId, sx, sy, sz, sr] = parts;
  const x = parseInt(sx, 10);
  const y = parseInt(sy, 10);
  const z = parseInt(sz, 10);
  const range = parseInt(sr, 10);

  if (![x, y, z, range].every(Number.isFinite)) return null;
  return { dimId, x, y, z, range };
}

function hopperKeyFromCoords(dimId, x, y, z) {
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

function spawnVacuum(dim, x, y, z, key, range) {
  const center = { x: x + 0.5, y: y + 1.0, z: z + 0.5 };

  const vac = dim.spawnEntity(VACUUM_ENTITY_ID, center);
  vac.addTag(TAG_VACUUM);
  vac.addTag(TAG_VACUUM_KEY_PREFIX + key);
  vac.addTag(TAG_RANGE_PREFIX + range);

  // versão final: sem efeitos/sem nameTag (você pediu batom)
  try { vac.nameTag = ""; } catch { }

  return vac;
}

function getKey(vac) {
  const tags = vac.getTags();
  const t = tags.find((x) => x.startsWith(TAG_VACUUM_KEY_PREFIX));
  if (!t) return null;
  return t.substring(TAG_VACUUM_KEY_PREFIX.length);
}

function getRange(vac) {
  const tags = vac.getTags();
  const t = tags.find((x) => x.startsWith(TAG_RANGE_PREFIX));
  if (!t) return 0;
  const n = parseInt(t.substring(TAG_RANGE_PREFIX.length), 10);
  return Number.isFinite(n) ? n : 0;
}

function findRegistry(overworld) {
  const ents = overworld.getEntities({ tags: [TAG_REGISTRY] });
  for (const e of ents) return e;
  return null;
}

function ensureRegistry(overworld) {
  let reg = findRegistry(overworld);
  if (reg) return reg;

  // cria um registry “fixo” no mundo (pode ser em 0, 1, 0)
  reg = overworld.spawnEntity(REGISTRY_ENTITY_ID, { x: 0.5, y: 1.0, z: 0.5 });
  reg.addTag(TAG_REGISTRY);
  try { reg.nameTag = ""; } catch { }
  return reg;
}

system.runInterval(() => {
  const overworld = world.getDimension("overworld");
  const nether = world.getDimension("nether");
  const theEnd = world.getDimension("the_end");

  // 1) Registry global no overworld
  let registry;
  try {
    registry = ensureRegistry(overworld);
  } catch {
    return;
  }

  // 2) Lê todos os hoppers ativos do registry
  const tags = registry.getTags();
  const actives = tags
    .filter((t) => t.startsWith(TAG_ACTIVE_PREFIX))
    .map(parseActiveTag)
    .filter(Boolean);

  // 3) Para cada ativo: garante vacuum existe + faz puxar itens
  for (const a of actives) {
    const dim =
      a.dimId === "minecraft:overworld" ? overworld :
        a.dimId === "minecraft:nether" ? nether :
          a.dimId === "minecraft:the_end" ? theEnd :
            null;

    if (!dim) continue;

    const hopper = dim.getBlock({ x: a.x, y: a.y, z: a.z });
    if (!hopper || hopper.typeId !== HOPPER_ID) {
      // hopper sumiu → remove a tag do registry
      try { registry.removeTag(`${TAG_ACTIVE_PREFIX}${a.dimId}|${a.x}|${a.y}|${a.z}|${a.range}`); } catch { }
      continue;
    }

    const range = clamp(a.range, 0, ENDER_HOPPER_MAX_RANGE);
    if (range <= 0) continue;

    const key = hopperKeyFromCoords(a.dimId, a.x, a.y, a.z);

    // 3.1) Se vacuum foi quebrado, respawna
    let vac = findVacuum(dim, key);
    if (!vac) {
      try { vac = spawnVacuum(dim, a.x, a.y, a.z, key, range); } catch { }
      try {
        vac.nameTag = "";
        vac.addEffect("invisibility", 999999, {
          amplifier: 1,
          showParticles: false,
        });
      } catch { }
    } else {
      // garante range correto (se o player mudou pelo UI)
      const vr = getRange(vac);
      if (vr !== range) {
        // remove tags antigas e seta
        const vtags = vac.getTags();
        for (const t of vtags) {
          if (t.startsWith(TAG_RANGE_PREFIX)) {
            try { vac.removeTag(t); } catch { }
          }
        }
        try { vac.addTag(TAG_RANGE_PREFIX + range); } catch { }
      }
    }

    // 3.2) Mantém vacuum no topo do hopper
    const center = { x: a.x + 0.5, y: a.y + 1.0, z: a.z + 0.5 };
    try { vac.teleport(center); } catch { }

    // 3.3) Puxa itens (distância 3D)
    let items = [];
    try {
      items = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: range });
    } catch {
      items = [];
    }

    for (const it of items) {
      try {
        // topo do hopper (pra ser engolido)
        it.teleport({ x: a.x + 0.5, y: a.y + 1.1, z: a.z + 0.5 });
      } catch { }
    }
  }
}, 10);
