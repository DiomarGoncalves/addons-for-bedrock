import {
  system,
  world,
  EntityComponentTypes,
  EquipmentSlot
} from "@minecraft/server";

function capitalizeWords(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/^minecraft:/, "")
    .replace(/_/g, " ")
    .split(" ")
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

system.beforeEvents.startup.subscribe(ev => {
  ev.itemComponentRegistry.registerCustomComponent(
    "cloudrelic:knowledge_seeker",
    {}
  );
});

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      const equip = player.getComponent(EntityComponentTypes.Equippable);
      if (!equip) continue;

      const main = equip.getEquipment(EquipmentSlot.Mainhand);
      const off = equip.getEquipment(EquipmentSlot.Offhand);

      const hasRelic =
        (main && main.typeId === "cloudrelic:knowledge_seeker") ||
        (off && off.typeId === "cloudrelic:knowledge_seeker");

      if (!hasRelic) continue;

      const entityHit = player.getEntitiesFromViewDirection({
        maxDistance: 8
      })?.[0];

      if (entityHit?.entity) {
        const ent = entityHit.entity;
        const healthComp = ent.getComponent(EntityComponentTypes.Health);
        const nameRaw = (typeof ent.nameTag === "string" && ent.nameTag.length)
          ? ent.nameTag
          : ent.typeId;
        const name = capitalizeWords(nameRaw);
        if (healthComp) {
          const current = Math.ceil(healthComp.currentValue ?? 0);
          const max = Math.ceil(healthComp.effectiveMax ?? 0);
          try { player.onScreenDisplay.setActionBar(`${name} §c${current}§7/§c${max} ❤`); } catch {}
          continue;
        }
        try { player.onScreenDisplay.setActionBar(name); } catch {}
        continue;
      }

      const blockHit = player.getBlockFromViewDirection({
        maxDistance: 8
      });

      if (blockHit?.block) {
        const id = capitalizeWords(blockHit.block.typeId);
        try { player.onScreenDisplay.setActionBar(id); } catch {}
      }
    } catch (e) {
      // safe-guard per-player loop
    }
  }
}, 5);