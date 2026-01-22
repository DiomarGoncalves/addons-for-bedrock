import { world, system, EquipmentSlot, EntityComponentTypes, ItemStack } from "@minecraft/server";

const HAM_CHAIN = [
  "cloudham:infinite_ham",
  "cloudham:infinite_ham_8",
  "cloudham:infinite_ham_7",
  "cloudham:infinite_ham_6",
  "cloudham:infinite_ham_5",
  "cloudham:infinite_ham_4",
  "cloudham:infinite_ham_3",
  "cloudham:infinite_ham_2",
  "cloudham:infinite_ham_1",
  "cloudham:infinite_ham_0"
];

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    if (!equip) continue;

    const item = equip.getEquipment(EquipmentSlot.Mainhand);
    if (!item) continue;

    const index = HAM_CHAIN.indexOf(item.typeId);
    if (index === -1 || index === HAM_CHAIN.length - 1) continue;

    equip.setEquipment(
      EquipmentSlot.Mainhand,
      new ItemStack(HAM_CHAIN[index + 1], item.amount)
    );
  }
}, 400);