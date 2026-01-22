import {
  world,
  system,
  Player,
  EntityDamageCause,
  EntityComponentTypes,
  EquipmentSlot
} from "@minecraft/server";

const FEATHER_ID = "holycloud:angelic_feather";

const SAFE_HEAL_AMOUNT = 14;
const FALL_PROTECT_TICKS = 3;

const fallProtection = new Map();

function hasFeather(player) {
  const equip = player.getComponent("minecraft:equippable");
  if (equip) {
    if (equip.getEquipment(EquipmentSlot.Mainhand)?.typeId === FEATHER_ID) return true;
    if (equip.getEquipment(EquipmentSlot.Offhand)?.typeId === FEATHER_ID) return true;
  }

  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;

  for (let i = 0; i < inv.size; i++) {
    if (inv.getItem(i)?.typeId === FEATHER_ID) return true;
  }

  return false;
}

world.afterEvents.entityHurt.subscribe((ev) => {
  const player = ev.hurtEntity;

  if (!(player instanceof Player)) return;
  if (ev.damageSource.cause !== EntityDamageCause.fall) return;
  if (!hasFeather(player)) return;

  fallProtection.set(player.id, FALL_PROTECT_TICKS);
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const ticksLeft = fallProtection.get(player.id);
    if (!ticksLeft) continue;

    const health = player.getComponent(EntityComponentTypes.Health);
    if (!health) continue;

    if (health.currentValue <= SAFE_HEAL_AMOUNT) {
      health.setCurrentValue(
        Math.min(health.effectiveMax, health.currentValue + SAFE_HEAL_AMOUNT)
      );
    }

    if (ticksLeft <= 1) {
      fallProtection.delete(player.id);
    } else {
      fallProtection.set(player.id, ticksLeft - 1);
    }
  }
}, 1);