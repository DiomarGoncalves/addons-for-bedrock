import { world, BlockPermutation } from "@minecraft/server";

/**
 * @file lightwand_logic.js (Cleaned)
 * Handles Light Wand usage, placing light blocks, and torch projectile.
 */

const LIGHT_WAND_ID = "lightwand:light_wand";
const LIGHT_BLOCKS = [
  "lightwand:light_block_1",
  "lightwand:light_block_2",
  "lightwand:light_block_3",
  "lightwand:light_block_4",
  "lightwand:light_block_5",
  "lightwand:light_block_6",
  "lightwand:light_block_7",
  "lightwand:light_block_8",
  "lightwand:light_block_9",
  "lightwand:light_block_10",
  "lightwand:light_block_11",
  "lightwand:light_block_12",
  "lightwand:light_block_13",
  "lightwand:light_block_14",
  "lightwand:light_block_15",
];

class LightWand {
  constructor(block, item, player) {
    this.block = block;
    this.item = item;
    this.player = player;
    this.dimension = block?.dimension || player?.dimension;
    this.inv = player?.getComponent("minecraft:inventory")?.container;
  }

  /** Fire torch projectile forward */
  throwTorch() {
    const player = this.player;
    const view = player.getViewDirection();
    const head = player.getHeadLocation();
    const spawnLoc = {
      x: head.x + view.x * 0.5,
      y: head.y + view.y * 0.5,
      z: head.z + view.z * 0.5,
    };

    const projectile = player.dimension.spawnEntity("lightwand:arrow", spawnLoc);
    projectile.addTag("torch_projectile");

    const velocity = { x: view.x * 3, y: view.y * 3, z: view.z * 3 };
    projectile.applyImpulse(velocity);
    this.reduceDurability(3);
  }

  /** Place max light block on face */
  useOnBlock(face) {
    const target = this.getBlockFromFace(face);
    if (!target || !this.dimension) return;
    this.dimension.setBlockType(target, "lightwand:light_block_15");
    this.reduceDurability(1);
  }

  /** Cycle through light levels */
  interactToLightBlock() {
    if (!this.block || !this.dimension) return;
    const index = LIGHT_BLOCKS.indexOf(this.block.typeId);
    if (index === -1) return;
    const next = (index + 1) % LIGHT_BLOCKS.length;
    this.dimension.setBlockType(this.block.location, LIGHT_BLOCKS[next]);
    this.player.onScreenDisplay.setActionBar(`Range: ${next + 1}`);
  }

  /** Reduce durability & handle breaking */
  reduceDurability(amount) {
    if (!this.item || !this.player || !this.inv) return;
    const slot = this.player.selectedSlotIndex;
    const dur = this.item.getComponent("minecraft:durability");
    if (!dur) return;

    dur.damage = (dur.damage || 0) + amount;

    if (dur.damage >= dur.maxDurability) {
      this.player.sendMessage("§cYour Light Wand has shattered!");
      this.inv.setItem(slot, undefined);
    } else {
      this.inv.setItem(slot, this.item);
      const remain = dur.maxDurability - dur.damage;
      this.player.sendMessage(`§eLight Wand Durability: §7${remain}/${dur.maxDurability}`);
    }
  }

  /** Get block from face direction */
  getBlockFromFace(face) {
    if (!this.block) return undefined;
    const loc = this.block.location;
    const dirs = {
      East: { x: loc.x + 1, y: loc.y, z: loc.z },
      West: { x: loc.x - 1, y: loc.y, z: loc.z },
      South: { x: loc.x, y: loc.y, z: loc.z + 1 },
      North: { x: loc.x, y: loc.y, z: loc.z - 1 },
      Up: { x: loc.x, y: loc.y + 1, z: loc.z },
      Down: { x: loc.x, y: loc.y - 1, z: loc.z },
    };
    return dirs[face];
  }
}

/* Item use (Right-click or tap) */
world.afterEvents.itemUse.subscribe(e => {
  const { itemStack, source } = e;
  if (!itemStack || itemStack.typeId !== LIGHT_WAND_ID) return;

  const find = source.getBlockFromViewDirection({ maxDistance: 15 });

  if (!find) {
    new LightWand(null, itemStack, source).throwTorch();
    return;
  }

  const block = find.block;
  const face = find.face;
  const wand = new LightWand(block, itemStack, source);

  if (LIGHT_BLOCKS.includes(block.typeId)) wand.interactToLightBlock();
  else wand.useOnBlock(face);
});

/* Torch projectile placement */
world.afterEvents.projectileHitBlock.subscribe(event => {
  const { projectile } = event;
  if (!projectile.hasTag("torch_projectile")) return;

  const face = event.getBlockHit()?.face;
  const block = event.getBlockHit()?.block;
  if (!block) return;
   let loc = new LightWand(block, null, null).getBlockFromFace(face)


  projectile.dimension.getBlock(loc).setType("lightwand:light_block_15");
  projectile.remove();
});