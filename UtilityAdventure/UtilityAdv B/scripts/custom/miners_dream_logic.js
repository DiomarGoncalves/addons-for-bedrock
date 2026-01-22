import { system, BlockPermutation } from "@minecraft/server";

const COMPONENT_ID = "holycloud:miners_dream_component";

const VALID_START_BLOCKS = new Set([
  "minecraft:stone",
  "minecraft:deepslate",
  "minecraft:netherrack",
  "minecraft:end_stone",
  "minecraft:diorite",
  "minecraft:granite",
  "minecraft:andesite"
]);

const REMOVABLE_BLOCKS = new Set([
  "minecraft:stone",
  "minecraft:deepslate",
  "minecraft:andesite",
  "minecraft:diorite",
  "minecraft:granite",
  "minecraft:dirt",
  "minecraft:gravel",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:water",
  "minecraft:lava",
  "minecraft:netherrack",
  "minecraft:end_stone",
  "minecraft:netherrack"
]);

const RADIUS = 10;
const HEIGHT = 20;
const BLOCKS_PER_TICK = 800;

const tasks = [];
let tickHandle = 0;

function* minerTask(dimension, origin, dir) {
  const AIR = BlockPermutation.resolve("minecraft:air");

  const fx = Math.abs(dir.x) > Math.abs(dir.z) ? Math.sign(dir.x) : 0;
  const fz = Math.abs(dir.z) >= Math.abs(dir.x) ? Math.sign(dir.z) : 0;

  let processed = 0;

  for (let layer = 0; layer < HEIGHT; layer++) {
    for (let y = 0; y < HEIGHT; y++) {
      for (let w = -RADIUS; w <= RADIUS; w++) {
        const x = origin.x + fx * layer + (fx === 0 ? w : 0);
        const z = origin.z + fz * layer + (fz === 0 ? w : 0);
        const by = origin.y + y;

        const b = dimension.getBlock({ x, y: by, z });
        if (b && REMOVABLE_BLOCKS.has(b.typeId)) {
          b.setPermutation(AIR);
        }

        processed++;
        if (processed >= BLOCKS_PER_TICK) {
          processed = 0;
          yield;
        }
      }
    }
    yield;
  }
}

function startTask(dimension, origin, dir) {
  tasks.push(minerTask(dimension, origin, dir));
  if (!tickHandle) tickHandle = system.run(runTasks);
}

function runTasks() {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const r = tasks[i].next();
    if (r.done) tasks.splice(i, 1);
  }
  if (tasks.length > 0) {
    tickHandle = system.run(runTasks);
  } else {
    tickHandle = 0;
  }
}
  system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent
    (COMPONENT_ID, {
    onUseOn(e) {
      const player = e.source;
      const hit = e.block;
      if (!player || !hit) return;
      if (!VALID_START_BLOCKS.has(hit.typeId)) return;

      const dir = player.getViewDirection();
      const dim = hit.dimension;
      const origin = hit.location;

      startTask(dim, origin, dir);

      const inv = player.getComponent("minecraft:inventory")?.container;
      if (!inv) return;

      const slot = player.selectedSlotIndex;
      const stack = inv.getItem(slot);
      if (!stack) return;

      if (stack.amount > 1) {
        stack.amount -= 1;
        inv.setItem(slot, stack);
      } else {
        inv.setItem(slot, undefined);
      }
    }
  });
});