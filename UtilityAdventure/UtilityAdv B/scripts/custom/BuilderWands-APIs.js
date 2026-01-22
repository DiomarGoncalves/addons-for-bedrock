// BuilderWands-APIs.js - Updated for Minecraft Bedrock Scripting API 2.1.0

import {
  world,
  system,
  CommandPermissionLevel,
  CustomCommandParamType,
  EntityComponentTypes,
  EquipmentSlot,
  ItemComponentTypes,
  GameMode
} from "@minecraft/server";

// Track modes
const matchingMode = new Map();
const randomMode   = new Map();

// ------------------------- Register Commands -----------------------------
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {

  customCommandRegistry.registerCommand({
    name: "dc:matching",
    description: "Choose how the wand matches blocks.",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [{ name: "mode", type: CustomCommandParamType.String }]
  }, (origin, mode) => {
    const p = origin.sourceEntity;
    if (!p) return;
    mode = (mode + "").toUpperCase();
    if (!["EXACT", "SIMILAR", "ANY"].includes(mode)) return;
    matchingMode.set(p.id, mode);
  });

  customCommandRegistry.registerCommand({
    name: "dc:random",
    description: "Random block placement for wand.",
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [{ name: "toggle", type: CustomCommandParamType.String }]
  }, (origin, toggle) => {
    const p = origin.sourceEntity;
    if (!p) return;
    toggle = toggle.toLowerCase();
    if (toggle !== "on" && toggle !== "off") return;
    randomMode.set(p.id, toggle === "on");
  });
});

// ------------------------- Register Wand Component -----------------------------
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("builder_wands:wand", builderWandComponent);
});

// ------------------------- Component Behavior -----------------------------
const builderWandComponent = {
  onUseOn: (e, p) => {
    const player = e.source;
    const hit = e.block;
    if (!player || !hit) return;

    const maxBlocks = p.params.block_placed || 0;
    const matchMode = matchingMode.get(player.id) || "EXACT";
    const isRandom = randomMode.get(player.id) || false;

    // >>> USE PLAYER VIEW DIRECTION (dominant axis) <<<
    const dir = player.getBlockFromViewDirection({maxdistance: 14, includeLiquidBlocks: true}).face
    const viewOffset = faceDirection[dir]

    system.runJob(fillShapeExtend(player, hit.dimension, hit.location, hit.typeId, viewOffset, matchMode, isRandom, maxBlocks))
  }
};

const faceDirection = {
  "North": {x: 0, y: 0, z: -1},
  "South": {x: 0, y: 0, z: 1},
  "East": {x: 1, y: 0, z: 0},
  "West": {x: -1, y: 0, z: 0},
  "Up": {x: 0, y: 1, z: 0},
  "Down": {x: 0, y: -1, z: 0},
}

const neighborX = [
  { x: 0, y: 0, z: +1 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: +1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: +1, z: +1 },
  { x: 0, y: -1, z: +1 },
  { x: 0, y: +1, z: -1 },
  { x: 0, y: -1, z: -1 }
]

const neighborY = [
  { x: +1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: +1 },
  { x: 0, y: 0, z: -1 },
  { x: +1, y: 0, z: +1 },
  { x: +1, y: 0, z: -1 },
  { x: -1, y: 0, z: +1 },
  { x: -1, y: 0, z: -1 }
]

const neighborZ = [
  { x: +1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: +1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: +1, y: +1, z: 0 },
  { x: +1, y: -1, z: 0 },
  { x: -1, y: +1, z: 0 },
  { x: -1, y: -1, z: 0 }
]

const neighborList = {
  "0,0,-1": neighborZ,
  "0,0,1": neighborZ,
  "0,1,0": neighborY,
  "0,-1,0": neighborY,
  "1,0,0": neighborX,
  "-1,0,0": neighborX
}

// ==============================
// Exact-shape extension function
// ==============================
/**
 * Detects the entire connected shape of matching blocks starting at startLoc,
 * then attempts to place a shifted copy (shape positions + offset).
 *
 * @returns {number} total blocks placed
 */
function* fillShapeExtend(player, dim, startLoc, targetTypeId, offset, matchMode, isRandom, maxBlocks) {
  const invComp = player.getComponent(EntityComponentTypes.Inventory);
  if (!invComp) return 0;
  const inventory = invComp.container;
  const creative = player.getGameMode() === GameMode.Creative;

  // helper keys
  const keyOf = (loc) => `${loc.x},${loc.y},${loc.z}`;

  // matching rules
  function matchesMode(blockType) {
    if (matchMode === "ANY") return true;
    if (matchMode === "EXACT") return blockType === targetTypeId;
    if (matchMode === "SIMILAR") return isSimilar(blockType, targetTypeId);
    return false;
  }

  // inventory helpers
  function countAvailableOf(typeId) {
    if (creative) return Infinity;
    let count = 0;
    for (let i = 0; i < inventory.size; i++) {
      const s = inventory.getItem(i);
      if (s && s.typeId === typeId) count += s.amount;
    }
    return count;
  }
  function removeOneOf(typeId) {
    if (creative) return true;
    for (let i = 0; i < inventory.size; i++) {
      const s = inventory.getItem(i);
      if (s && s.typeId === typeId) {
        if (s.amount > 1) {
          const newStack = s;
          newStack.amount -= 1;
          inventory.setItem(i, newStack);
        } else {
          inventory.setItem(i, undefined);
        }
        return true;
      }
    }
    return false;
  }
  function hasAnyItem() {
    if (creative) return true;
    for (let i = 0; i < inventory.size; i++) {
      const s = inventory.getItem(i);
      if (s && s.amount > 0 && s.typeId.startsWith("minecraft:")) return true;
    }
    return false;
  }
  function removeOneRandom() {
    if (creative) return null;
    const choices = [];
    for (let i = 0; i < inventory.size; i++) {
      const s = inventory.getItem(i);
      if (s && s.amount > 0 && s.typeId.startsWith("minecraft:")) choices.push({ idx: i, type: s.typeId });
    }
    if (choices.length === 0) return null;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    const stack = inventory.getItem(pick.idx);
    const typePicked = stack.typeId;
    if (stack.amount > 1) {
      const newStack = stack;
      newStack.amount -= 1;
      inventory.setItem(pick.idx, newStack);
    } else {
      inventory.setItem(pick.idx, undefined);
    }
    return typePicked;
  }

  // 1) Flood-fill to collect connected shape positions
  const shapePositions = [];
  const seen = new Set();
  const blockList = [ startLoc ];
  seen.add(keyOf(startLoc));

  const neigh = neighborList[keyOf(offset)]
  if(!neigh) return

  let realIndex = 0
  while (realIndex < blockList.length && blockList.length < maxBlocks) {
    const loc = blockList[realIndex++];
    if(!loc) continue

    // verify block at loc still exists and matches mode
    try {
      const b = dim.getBlock(loc);
      if (!b) continue;
      if (!matchesMode(b.typeId)) continue;

      shapePositions.push(loc);

      for (const n of neigh) {
        if(blockList.length >= maxBlocks) continue
        const pos = { x: loc.x + n.x, y: loc.y + n.y, z: loc.z + n.z }
        const k = keyOf(pos);
        if (seen.has(k)) continue;
        seen.add(k);
        // only continue flood if neighbor block matches mode
        try {
          const nb = dim.getBlock(pos);
          if (!nb) continue;
          if (matchesMode(nb.typeId)) blockList.push(pos);
        } catch {}
      }
    } catch {}
    yield
  }

  if (shapePositions.length === 0) return

  // 3) Attempt to place blocks at each dest where space is air
  let totalPlaced = 0;

  // If not random, count available of targetTypeId
  let availableCount = countAvailableOf(targetTypeId);

  // If no items at all (and not creative), abort
  if (!creative && !isRandom && availableCount <= 0) return 0;
  if (!creative && isRandom && !hasAnyItem()) return 0;

  // Iterate positions in deterministic order (optional: sort by y then x then z)

  for (const dest of blockList) {
    // Respect maxBlocks
    if (maxBlocks > 0 && totalPlaced >= maxBlocks) break;

    // Check current block at dest
    try {
      const curr = dim.getBlock({ x: dest.x + offset.x, y: dest.y + offset.y, z: dest.z + offset.z });
      if (!curr) continue;

      // Only place into air
      if (!curr.isAir) continue;

      // Determine block type to place
      let placeType = targetTypeId;
      if (isRandom) {
        const picked = removeOneRandom();
        if (!picked) return totalPlaced;
        placeType = picked;
      } else {
        if (!creative) {
          if (availableCount <= 0) break;
          if (!removeOneOf(targetTypeId)) break;
          availableCount--;
        }
      }

      // place
      curr.setType(placeType);
      totalPlaced++;
      yield
    } catch {}
  }

  if (totalPlaced > 0 && player.getGameMode() !== GameMode.Creative) {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    const hand = equip.getEquipmentSlot(EquipmentSlot.Mainhand);
    const wand = hand.getItem();
    if (!wand) return;
    const dur = wand.getComponent(ItemComponentTypes.Durability);
    if (dur) {
      dur.damage++;
      if (dur.damage >= dur.maxDurability) {
        hand.setItem(undefined);
      } else {
        hand.setItem(wand);
      }
    }
  }
}

// -------------------------------
// Keep your existing isSimilar helper
// -------------------------------
function isSimilar(a, b) {
  if (a === b) return true;
  const groups = [
    ["minecraft:dirt", "minecraft:grass_block"],
    ["minecraft:oak_log", "minecraft:stripped_oak_log"],
    ["minecraft:sand", "minecraft:red_sand"]
  ];
  return groups.some(group => group.includes(a) && group.includes(b));
}