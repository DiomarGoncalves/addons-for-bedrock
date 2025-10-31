// BP/scripts/main.js
import { world, system } from "@minecraft/server";

const TARGET_BLOCK_ID = "diomar:chunkloader";
const PARTICLE_ID = "minecraft:villager_happy";
const PARTICLE_STEP = 1;

// --------- utils ----------
function floorTo16(n) { return Math.floor(n / 16) * 16; }
function chunkBoundsFromPos(pos) {
  const x0 = floorTo16(pos.x);
  const z0 = floorTo16(pos.z);
  return { x0, z0, x1: x0 + 40, z1: z0 + 40 };
}
function makeChunkKey(x0, z0) { return `${x0},${z0}`; }
function makeChunkName(x0, z0) { return `chunk_${x0/16}_${z0/16}`; }

// Mantemos um índice leve dos chunks criados (para o fallback)
const activeChunks = new Map(); // key: "x0,z0" -> { dimId, blockPos: {x,y,z} }

// --------- criar ----------
async function createTickingAreaAndParticles(dimension, blockLoc) {
  const { x0, z0, x1, z1 } = chunkBoundsFromPos(blockLoc);
  const name = makeChunkName(x0, z0);

  // cria área (por coordenadas + nome)
  try {
    await dimension.runCommandAsync(
      `tickingarea add ${x0} 0 ${z0} ${x1} 0 ${z1} ${name} true`
    );
  } catch (_) {}

  // partículas
  const y = blockLoc.y + 1;
  for (let x = x0; x <= x1; x += PARTICLE_STEP) {
    for (let z = z0; z <= z1; z += PARTICLE_STEP) {
      try { dimension.spawnParticle(PARTICLE_ID, { x, y, z }); } catch {}
    }
  }
  for (let x = x0; x <= x1; x += 1) {
    try { dimension.spawnParticle(PARTICLE_ID, { x, y, z: z0 }); } catch {}
    try { dimension.spawnParticle(PARTICLE_ID, { x, y, z: z1 }); } catch {}
  }
  for (let z = z0; z <= z1; z += 1) {
    try { dimension.spawnParticle(PARTICLE_ID, { x: x0, y, z }); } catch {}
    try { dimension.spawnParticle(PARTICLE_ID, { x: x1, y, z }); } catch {}
  }

  // indexa para fallback (1.19)
  try {
    activeChunks.set(
      makeChunkKey(x0, z0),
      { dimId: dimension.id, blockPos: { x: blockLoc.x, y: blockLoc.y, z: blockLoc.z } }
    );
  } catch {}

  try {
    await dimension.runCommandAsync(
      `tellraw @a {"rawtext":[{"text":"§a[ChunkLoader] Área criada: ${x0},${z0} até ${x1},${z1}."}]}`
    );
  } catch {}
}

// --------- remover ----------
async function removeTickingAreaForPos(dimension, pos) {
  const { x0, z0, x1, z1 } = chunkBoundsFromPos(pos);
  const key = makeChunkKey(x0, z0);
  const name = makeChunkName(x0, z0);

  // primeiro por coordenadas (mais garantido)
  try {
    await dimension.runCommandAsync(
      `tickingarea remove ${x0} 0 ${z0} ${x1} 0 ${z1}`
    );
  } catch (_) {
    // tenta por nome, se coordenadas falharem
    try { await dimension.runCommandAsync(`tickingarea remove ${name}`); } catch {}
  }

  activeChunks.delete(key);

  try {
    await dimension.runCommandAsync(
      `tellraw @a {"rawtext":[{"text":"§c[ChunkLoader] Área removida (${x0},${z0}–${x1},${z1})."}]}`
    );
  } catch {}
}

// --------- detecção de colocação (igual antes) ----------
function setupBlockPlaceIfAvailable() {
  const bp = world.afterEvents?.blockPlace;
  if (!bp || typeof bp.subscribe !== "function") return false;

  bp.subscribe(async (ev) => {
    try {
      if (ev.block?.typeId !== TARGET_BLOCK_ID) return;
      await createTickingAreaAndParticles(ev.dimension, ev.block.location);
    } catch {}
  });
  return true;
}

function guessPlacedBlockPosFromUseOn(ev) {
  const base = ev.block?.location;
  if (!base) return null;

  const offsets = [
    { x:  1, y:  0, z:  0 },
    { x: -1, y:  0, z:  0 },
    { x:  0, y:  1, z:  0 },
    { x:  0, y: -1, z:  0 },
    { x:  0, y:  0, z:  1 },
    { x:  0, y:  0, z: -1 },
  ];

  const dim = ev.source?.dimension ?? world.getDimension("overworld");
  return new Promise((resolve) => {
    system.run(() => {
      for (const o of offsets) {
        const pos = { x: base.x + o.x, y: base.y + o.y, z: base.z + o.z };
        try {
          const b = dim.getBlock(pos);
          if (b?.typeId === TARGET_BLOCK_ID) {
            resolve(pos);
            return;
          }
        } catch {}
      }
      resolve(null);
    });
  });
}

function setupItemUseOnFallback() {
  const iu = world.afterEvents?.itemUseOn;
  if (!iu || typeof iu.subscribe !== "function") return false;

  iu.subscribe(async (ev) => {
    try {
      if (ev.itemStack?.typeId !== TARGET_BLOCK_ID) return;
      const pos = await guessPlacedBlockPosFromUseOn(ev);
      if (!pos) return;
      const dim = ev.source?.dimension ?? world.getDimension("overworld");
      await createTickingAreaAndParticles(dim, pos);
    } catch {}
  });
  return true;
}

// --------- detecção de remoção ----------
function setupBlockBreakRemovalIfAvailable() {
  const bb = world.afterEvents?.blockBreak;
  if (!bb || typeof bb.subscribe !== "function") return false;

  bb.subscribe(async (ev) => {
    try {
      if (ev.brokenBlockPermutation?.type?.id !== TARGET_BLOCK_ID) return;
      const pos = ev.block?.location ?? ev.blockPermutation?.block?.location ?? ev.player?.location;
      if (!pos) return;
      // usa mesma dimensão do evento
      const dim = ev.dimension ?? ev.player?.dimension ?? world.getDimension("overworld");
      await removeTickingAreaForPos(dim, pos);
    } catch {}
  });
  return true;
}

// Fallback 1.19.x: varredura leve (a cada ~2s) para detectar blocos removidos
function setupSweepFallback() {
  // processa até N chunks por varredura pra ser leve
  const BATCH = 8;
  const keys = () => Array.from(activeChunks.keys());

  system.runInterval(() => {
    const list = keys();
    if (!list.length) return;

    for (let i = 0; i < Math.min(BATCH, list.length); i++) {
      const key = list[i];
      const entry = activeChunks.get(key);
      if (!entry) continue;

      const dim = world.getDimension(entry.dimId ?? "overworld");
      try {
        const b = dim.getBlock(entry.blockPos);
        if (!b || b.typeId !== TARGET_BLOCK_ID) {
          // bloco não existe mais -> remover ticking area
          removeTickingAreaForPos(dim, entry.blockPos);
        }
      } catch {
        // se der erro de acesso, também remove por segurança
        removeTickingAreaForPos(dim, entry.blockPos);
      }
    }
  }, 40); // 40 ticks ≈ 2s
}

// --------- init ----------
(function init() {
  const hasPlace = setupBlockPlaceIfAvailable();
  if (!hasPlace) setupItemUseOnFallback();

  const hasBreak = setupBlockBreakRemovalIfAvailable();
  if (!hasBreak) setupSweepFallback();

  try {
    world.getDimension("overworld").runCommandAsync(
      `tellraw @a {"rawtext":[{"text":"§b[ChunkLoader] Ativo (cria e remove automático)."}]}`
    );
  } catch {}
})();
