import { ItemStack } from "@minecraft/server";

export class InventoryUtils {
    static hasFuel(player) {
        const inventory = player.getComponent("inventory");
        if (!inventory || !inventory.container) return false;

        const container = inventory.container;
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && item.typeId === "minecraft:coal") {
                return true;
            }
        }
        return false;
    }

    static consumeFuel(player) {
        const inventory = player.getComponent("inventory");
        if (!inventory || !inventory.container) return false;

        const container = inventory.container;
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && item.typeId === "minecraft:coal") {
                if (item.amount > 1) {
                    item.amount--;
                    container.setItem(i, item);
                } else {
                    container.setItem(i, undefined);
                }
                return true;
            }
        }
        return false;
    }

    static getEquippedChestplate(player) {
        const equipment = player.getComponent("equippable");
        if (!equipment) return null;
        return equipment.getEquipment("Chest");
    }
}
