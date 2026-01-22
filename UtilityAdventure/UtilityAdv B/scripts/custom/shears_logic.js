import {
  world,
  system,
  ItemStack,
  GameMode,
  BlockPermutation,
  EquipmentSlot,
  EntityComponentTypes
} from "@minecraft/server";

const ShearsSound = "random.shears";
const BeeShearsSound = "block.beehive.shear";
const PumpkinShearsSound = "pumpkin.carve";

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("cloudshears:shears", cloudShearsComponent);
});

const cloudShearsComponent = {
  onUseOn(event) {
    const player = event.source;
    const block = event.block;
    if (!player || !block) return;
    const held = getHeldItem(player);
    if (!held || held.typeId !== "cloudshears:clay_shears") return;
    const blockId = block.typeId;
    if (blockId === "minecraft:pumpkin") {
      carvePumpkin(player, block, held);
      player.playSound(BeeShearsSound, {location: block.location});
      return;
    }
    if (blockId === "minecraft:beehive" || blockId === "minecraft:bee_nest") {
      harvestBeeHive(player, block, held);
      player.playSound(BeeShearsSound, {location: block.location});
      return;
    }
  }
};

function shearSnowGolem(player, snowman, held) {
  if (snowman.getComponent(EntityComponentTypes.IsSheared)) return;

  system.run(() => {
    snowman.triggerEvent("minecraft:on_sheared");
    const loc = snowman.location;
    snowman.dimension.spawnItem(new ItemStack("minecraft:carved_pumpkin", 1), {
      x: loc.x + 0.5,
      y: loc.y + 0.5,
      z: loc.z + 0.5
    });

    player.playSound("entity.snow_golem.shear", { location: snowman.location });
    applyDurability(player, held);
  })
}

function shearSheep(player, sheep, held) {
  if(sheep.getComponent(EntityComponentTypes.IsSheared)) return
  const variant = sheep.getComponent(EntityComponentTypes.Color);
  if (!variant) return;
  const color = variant.value;
  const woolId = `minecraft:${woolColors[color]}_wool`;
  const count = Math.floor(Math.random() * 2) + 1;

  system.run(() => {
    sheep.dimension.spawnItem(
      new ItemStack(woolId, count),
      { x: sheep.location.x, y: sheep.location.y + 0.5, z: sheep.location.z }
    );
    variant.value = 0;
    player.playSound("entity.sheep.shear", { location: sheep.location })
    try { sheep.triggerEvent("minecraft:on_sheared"); } catch {}
    applyDurability(player, held);
  });
}

const woolColors = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black"
];

function harvestBeeHive(player, block, held) {
  try {
    const perm = block.permutation;
    let honey = perm.getState ? perm.getState("honey_level") : undefined;
    if (typeof honey === "string") honey = parseInt(honey);
    if (honey !== 5) return;
    let newPerm;
    try {
      newPerm = perm.withState ? perm.withState("honey_level", 0) : BlockPermutation.resolve(block.typeId, { "honey_level": 0 });
      block.setPermutation(newPerm);
    } catch {
      try { block.setPermutation(BlockPermutation.resolve(block.typeId)); } catch {}
    }
    const dim = player.dimension;
    const loc = block.location;
    dim.spawnItem(new ItemStack("minecraft:honeycomb", 3), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
    player.playSound(BeeShearsSound, {location: block.location});
    applyDurability(player, held);
  } catch {}
}

function carvePumpkin(player, block, held) {
  try {
    const dim = block.dimension;
    const loc = block.location;
    const facing = getPumpkinFacing(player);
    const perm = BlockPermutation.resolve("minecraft:carved_pumpkin", {
      "minecraft:cardinal_direction": facing
    });
    try {
      block.setPermutation(perm);
    } catch {
      try { dim.setBlockType?.(loc, "minecraft:carved_pumpkin"); } catch {}
    }
    dim.spawnItem(new ItemStack("minecraft:pumpkin_seeds", 4), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 });
    try { player.playSound(PumpkinShearsSound); } catch {}
    applyDurability(player, held);
  } catch {}
}

const specialDrops = {
  "minecraft:vine": "minecraft:vine",
  "minecraft:nether_sprouts": "minecraft:nether_sprouts",
  "minecraft:fern": "minecraft:fern",
  "minecraft:large_fern": "minecraft:large_fern",
  "minecraft:deadbush": "minecraft:deadbush",
  "minecraft:oak_leaves": "minecraft:oak_leaves",
  "minecraft:birch_leaves": "minecraft:birch_leaves",
  "minecraft:spruce_leaves": "minecraft:spruce_leaves",
  "minecraft:jungle_leaves": "minecraft:jungle_leaves",
  "minecraft:acacia_leaves": "minecraft:acacia_leaves",
  "minecraft:dark_oak_leaves": "minecraft:dark_oak_leaves",
  "minecraft:web": "minecraft:web",
  "minecraft:short_grass": "minecraft:short_grass",
  "minecraft:tall_grass": "minecraft:short_grass"
};

world.afterEvents.playerBreakBlock.subscribe(ev => {
  try {
    const player = ev.player;
    const held = ev.itemStackBeforeBreak;
    const perm = ev.brokenBlockPermutation;
    const block = ev.block;
    if (!player || !held || !perm || !block) return;
    if (held.typeId !== "cloudshears:clay_shears") return;
    const blockId = perm.type?.id ?? perm.typeId ?? null;
    if (!blockId || blockId === "minecraft:air") return;
    const special = specialDrops[blockId];
    if (special) {
      const count = blockId === "minecraft:tall_grass" ? 2 : 1;
      try { block.dimension.spawnItem(new ItemStack(special, count), { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 }); } catch {}
    }
    try { player.playSound(ShearsSound); } catch {}
    applyDurability(player, held);
  } catch {}
});

world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
  const item = ev.itemStack;
  if (item?.typeId !== "cloudshears:clay_shears") return;

  if (ev.target.typeId === "minecraft:sheep") {
    shearSheep(ev.player, ev.target, item);
    return;
  }

  if (ev.target.typeId === "minecraft:snow_golem") {
    shearSnowGolem(ev.player, ev.target, item);
    return;
  }
});

function applyDurability(player, item) {
  try {
    const gm = player.getGameMode();
    if (gm === GameMode.Creative || gm === GameMode.Spectator) return;
    const comp = item.getComponent("durability");
    if (!comp) return;
    if (comp.damage + 1 > comp.maxDurability) {
      player.getComponent("equippable")?.setEquipment("Mainhand", undefined);
      try { player.playSound("random.break"); } catch {}
      return;
    }
    comp.damage += 1;
    player.getComponent("equippable")?.setEquipment("Mainhand", item);
  } catch {}
}

function getHeldItem(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}

function playPumpkinShearsSound(player) {
  try { player.playSound(PumpkinShearsSound); } catch {}
}

function getPumpkinFacing(player) {
  const v = player.getViewDirection();
  if (Math.abs(v.x) > Math.abs(v.z)) {
    return v.x > 0 ? "west" : "east";
  }
  return v.z > 0 ? "north" : "south";
}