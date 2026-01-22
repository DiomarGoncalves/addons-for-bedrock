import { world, system, EntityComponentTypes, Player } from "@minecraft/server";

const COMPONENT_ID = "holycloud:rending_gale_component";
const FEATHER_ID = "minecraft:feather";

const MODES = ["LIGHTNING", "PUSH", "PULL", "BLINK", "XP", "SWAP", "FLASH_STEP"];
const COLORS = ["§e", "§c", "§9", "§d", "§a", "§b", "§6"];

const BLINK_KEY = "rending_gale_blinks";
const MAX_BLINKS = 50;

const DOUBLE_CLICK_TIME = 10;
const XP_STEP = 25;
const XP_TICKS_FALLBACK = 200;

const clickTracker = new Map();

world.afterEvents.worldLoad.subscribe(() => {
  if (!world.getDynamicProperty(BLINK_KEY)) {
    world.setDynamicProperty(BLINK_KEY, "{}");
  }
});

function getInv(player) {
  return player.getComponent(EntityComponentTypes.Inventory)?.container;
}

function countFeathers(player) {
  const inv = getInv(player);
  let total = 0;
  if (!inv) return 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId === FEATHER_ID) total += it.amount;
  }
  return total;
}

function consumeFeathers(player, cost) {
  if (cost <= 0) return true;
  const inv = getInv(player);
  if (!inv || countFeathers(player) < cost) return false;
  let remaining = cost;
  for (let i = 0; i < inv.size && remaining > 0; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== FEATHER_ID) continue;
    if (it.amount > remaining) {
      it.amount -= remaining;
      inv.setItem(i, it);
      remaining = 0;
    } else {
      remaining -= it.amount;
      inv.setItem(i);
    }
  }
  return true;
}

function getBlinkData() {
  try {
    return JSON.parse(world.getDynamicProperty(BLINK_KEY));
  } catch {
    return {};
  }
}

function saveBlinkData(data) {
  world.setDynamicProperty(BLINK_KEY, JSON.stringify(data));
}

function xpForLevel(level) {
  if (level <= 15) return 2 * level + 7;
  if (level <= 30) return 5 * level - 38;
  return 9 * level - 158;
}

function totalXpFromLevels(level) {
  let xp = 0;
  for (let i = 0; i < level; i++) xp += xpForLevel(i);
  return xp;
}

function tryGetPlayerTotalXP(player) {
  try {
    const lvl = typeof player.level === "number" ? player.level : 0;
    const progress = typeof player.experienceProgress === "number" ? player.experienceProgress : 0;
    const base = totalXpFromLevels(lvl);
    const extra = Math.floor(progress * xpForLevel(lvl));
    return base + extra;
  } catch {
    return null;
  }
}

function removeXpChunksExact(player, amount, done) {
  let remaining = amount;
  const id = system.runInterval(() => {
    if (!player.isValid) {
      system.clearRun(id);
      done(amount - remaining);
      return;
    }
    if (remaining <= 0) {
      system.clearRun(id);
      done(amount);
      return;
    }
    const step = Math.min(remaining, XP_STEP);
    if(player.xpEarnedAtCurrentLevel >= step){
      player.addExperience(-step)
      remaining -= step;
    } else {
      player.addLevels(-1)
      player.addExperience(player.totalXpNeededForNextLevel -1)
      if(player.getTotalXp() < step){
        system.clearRun(id);
        done(amount);
        return;
      }
    }
  }, 1);
}

function giveXPOverTime(player, total, done) {
  let remaining = total;
  const id = system.runInterval(() => {
    if (!player.isValid || remaining <= 0 || player.hasTag("xp_give_stop")) {
      player.isValid && player.removeTag("xp_give_stop")
      system.clearRun(id);
      if (typeof done === "function") done();
      return;
    }
    const step = Math.min(remaining, XP_STEP);
    player.addExperience(step);
    remaining -= step;
  }, 1);
}

function handleDoubleClick(player, item, inv, slot) {
  const now = system.currentTick;
  const last = clickTracker.get(player.id) ?? 0;
  clickTracker.set(player.id, now);
  if (player.isSneaking && now - last <= DOUBLE_CLICK_TIME) {
    let mode = item.getDynamicProperty("mode") ?? 0;
    mode = (mode + 1) % MODES.length;
    item.setDynamicProperty("mode", mode);
    inv.setItem(slot, item);
    player.onScreenDisplay.setActionBar(`${COLORS[mode]}${MODES[mode]} MODE`);
    return true;
  }
  return false;
}

function getLookEntity(player, range = 100) {
  const dir = player.getViewDirection();
  const origin = player.getHeadLocation();

  const ents = player.dimension.getEntities({
    location: origin,
    maxDistance: range,
    includePlayers: true
  });

  let best = null;
  let bestDot = 0.96;

  for (const ent of ents) {
    if (ent.id === player.id) continue;

    const dx = ent.location.x - origin.x;
    const dy = ent.location.y - origin.y;
    const dz = ent.location.z - origin.z;

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len <= 0) continue;

    const dot =
      (dx / len) * dir.x +
      (dy / len) * dir.y +
      (dz / len) * dir.z;

    if (dot > bestDot) {
      bestDot = dot;
      best = ent;
    }
  }
  return best;
}

function dashTeleport(player, offset) {
  const loc = player.location;
  player.teleport({
    x: loc.x + offset.x,
    y: loc.y + offset.y,
    z: loc.z + offset.z
  }, { dimension: player.dimension });
}

system.beforeEvents.startup.subscribe(ev => {
  ev.itemComponentRegistry.registerCustomComponent(COMPONENT_ID, {
    onUse(e) {
      const player = e.source;
      if (!player) return;
      const inv = getInv(player);
      const slot = player.selectedSlotIndex;
      const item = inv?.getItem(slot);
      if (!item) return;
      if (handleDoubleClick(player, item, inv, slot)) return;

      const mode = MODES[item.getDynamicProperty("mode") ?? 0];

      if (mode === "BLINK") {
        if (!consumeFeathers(player, 15)) return;
        const data = getBlinkData();
        const list = data[player.id] ?? [];
        if (!list.length) return;
        player.teleport(list.shift(), { dimension: player.dimension });
        data[player.id] = list;
        saveBlinkData(data);          
      }

    if (mode === "SWAP") {
  if (!consumeFeathers(player, 5)) return;

  const ent = getLookEntity(player);
  if (!ent) return;

  const playerLoc = {
    x: player.location.x,
    y: player.location.y,
    z: player.location.z
  };

  const entLoc = {
    x: ent.location.x,
    y: ent.location.y,
    z: ent.location.z
  };

  player.teleport(entLoc, { dimension: player.dimension });
  ent.teleport(playerLoc, { dimension: player.dimension });
}

  if (mode === "FLASH_STEP") {
  if (!consumeFeathers(player, 3)) return;

  const dir = player.getViewDirection();

  if (player.isJumping) {
    dashTeleport(player, { x: 0, y: 5, z: 0 });
    player.onScreenDisplay.setActionBar("§6Flash Step Up");
    return;
  }

  dashTeleport(player, {
    x: dir.x * 4,
    y: 0.2,
    z: dir.z * 4
  });
  player.onScreenDisplay.setActionBar("§6Flash Step Forward");
 }
  },
    
    onUseOn(e) {
      const player = e.source;
      const hit = e.block;
      if (!player || !hit) return;
      const inv = getInv(player);
      const slot = player.selectedSlotIndex;
      const item = inv?.getItem(slot);
      if (!item) return;
      const mode = MODES[item.getDynamicProperty("mode") ?? 0];
      const dir = player.getViewDirection();

      if (mode === "LIGHTNING") {
        if (!consumeFeathers(player, 1)) return;
        player.dimension.spawnEntity("minecraft:lightning_bolt", hit.location);
      }

      if (mode === "PUSH" || mode === "PULL") {
        if (!consumeFeathers(player, 1)) return;
        const ents = player.dimension.getEntities({ location: player.location, maxDistance: 8 });
        for (const ent of ents) {
          if (ent.id === player.id) continue;
          ent.applyImpulse({
            x: dir.x * (mode === "PULL" ? -1.2 : 1.2),
            y: 0.2,
            z: dir.z * (mode === "PULL" ? -1.2 : 1.2)
          });
          break;
        }
      }

      if (mode === "BLINK" && player.isSneaking) {
        if (!consumeFeathers(player, 15)) return;
        const data = getBlinkData();
        const list = data[player.id] ?? [];
        if (list.length >= MAX_BLINKS) return;
        list.push({
          x: hit.location.x + 0.5,
          y: hit.location.y + 1,
          z: hit.location.z + 0.5
        });
        data[player.id] = list;
        saveBlinkData(data);
      }

      if (mode === "XP"){
        if(player.isSneaking){
          if (!consumeFeathers(player, 25)) return;
          const exactTotal = tryGetPlayerTotalXP(player) ?? 0;
          if (typeof exactTotal === "number" && exactTotal > 0) {
            removeXpChunksExact(player, exactTotal, removed => {
              if (removed <= 0) return;
              const stored = item.getDynamicProperty("xp") ?? 0;
              const total = stored + removed;
              item.setDynamicProperty("xp", total);
              item.setLore([`§aStored XP: ${total}`]);
              inv.setItem(slot, item);
              player.onScreenDisplay.setActionBar("§aXP Stored: " + total);
            });
          }
        } else {
          if (!consumeFeathers(player, 25)) return;
          const stored = item.getDynamicProperty("xp") ?? 0;
          if (stored <= 0) return;

          giveXPOverTime(player, stored, () => {
            const currentItem = getInv(player).getItem(slot);
            if (currentItem && currentItem.typeId === item.typeId) {
              currentItem.setDynamicProperty("xp", 0);
              currentItem.setLore(["§aStored XP: 0"]);
              inv.setItem(slot, currentItem);
            } else {
              item.setDynamicProperty("xp", 0);
              item.setLore(["§aStored XP: 0"]);
              inv.setItem(slot, item);
            }
            player.onScreenDisplay.setActionBar("§aXP Released");
          });
        }
      }
    }
  });
});