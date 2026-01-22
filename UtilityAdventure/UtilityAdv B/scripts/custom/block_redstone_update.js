import { system, BlockPermutation } from "@minecraft/server";

const BLOCK_ID = "cloud_redstone:redstone_circuit";
const COMPONENT_ID = "redstone_circuit:redstone_2";
const STATE_KEY = "ubd:powered";
const CHECK_TICKS = 4;

const NEIGH_DIRS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];

const RedstoneCircuit = {
  onTick(e, comp) {
    try {
      if (!comp) comp = {};
      comp._tick = (comp._tick || 0) + 1;
      if (comp._tick % CHECK_TICKS !== 0) return;

      const block = e.block;
      if (!block || block.typeId !== BLOCK_ID) return;

      const dim = block.dimension;
      const o = block.location;
      let foundPowered = false;

      for (const d of NEIGH_DIRS) {
        try {
          const nb = dim.getBlock({ x: o.x + d.x, y: o.y + d.y, z: o.z + d.z });
          if (!nb) continue;

          const power = typeof nb.getRedstonePower === "function" ? (nb.getRedstonePower() ?? 0) : 0;
          if (typeof power === "number" && power > 0) { foundPowered = true; break; }

          try {
            const p = nb.permutation.getState?.("powered");
            if (p === 1 || p === true || p === "1" || p === "true") { foundPowered = true; break; }
          } catch {}

          try {
            const pressed = nb.permutation.getState?.("is_pressed");
            if (pressed === 1 || pressed === true || pressed === "1" || pressed === "true") { foundPowered = true; break; }
          } catch {}
        } catch {}
      }

      let currentState = 0;
      try {
        currentState = block.permutation.getState?.(STATE_KEY) ?? 0;
        if (currentState === "1") currentState = 1;
        if (currentState === "true") currentState = 1;
      } catch { currentState = 0; }

      const want = foundPowered ? 1 : 0;
      if (Number(currentState) !== want) {
        try {
          const perm = BlockPermutation.resolve(BLOCK_ID, { [STATE_KEY]: want });
          block.setPermutation(perm);
        } catch {
          try {
            const loc = { x: Math.floor(o.x), y: Math.floor(o.y), z: Math.floor(o.z) };
            block.setType("minecraft:air");
            dim.setBlockType?.(loc, BLOCK_ID);
            const rebuilt = dim.getBlock(loc);
            if (rebuilt) rebuilt.setPermutation(BlockPermutation.resolve(BLOCK_ID, { [STATE_KEY]: want }));
          } catch {}
        }
      }
    } catch {}
  }
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  try {
    blockComponentRegistry.registerCustomComponent(COMPONENT_ID, RedstoneCircuit);
  } catch {}
});