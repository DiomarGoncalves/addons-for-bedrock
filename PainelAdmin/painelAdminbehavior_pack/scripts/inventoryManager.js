import { ItemStack } from '@minecraft/server';

export class InventoryManager {
    getContainer(player) {
        try {
            const invComp = player.getComponent && (player.getComponent('minecraft:inventory') || player.getComponent('inventory'));
            if (!invComp || !invComp.container) return null;
            return invComp.container;
        } catch { return null; }
    }

    getPlayerInventory(player) {
        const container = this.getContainer(player);
        if (!container) return [];
        const items = [];

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item) {
                items.push({
                    slot: i,
                    name: item.typeId.replace('minecraft:', ''),
                    amount: item.amount,
                    typeId: item.typeId
                });
            }
        }

        return items;
    }

    clearInventory(player) {
        const container = this.getContainer(player);
        if (!container) return false;
        for (let i = 0; i < container.size; i++) { try { container.setItem(i, undefined); } catch { } }
        return true;
        player.sendMessage('§8[admin panel] seu inventário foi limpo por um administrador!');
    }

    removeItem(player, slot) {
        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;

        try {
            container.setItem(slot, undefined);
            return true;
        } catch (error) {
            return false;
        }
    }

    giveItem(player, itemId, amount = 1) {
        try {
            if (!itemId.includes(':')) {
                itemId = 'minecraft:' + itemId;
            }

            const item = new ItemStack(itemId, amount);
            const inventory = player.getComponent('minecraft:inventory');
            const container = inventory.container;

            container.addItem(item);
            player.sendMessage(`§8[admin panel] você recebeu ${amount}x ${itemId}!`);
            return true;
        } catch (error) {
            throw new Error(`Item inválido: ${itemId}`);
        }
    }

    hasSpace(player) {
        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;

        for (let i = 0; i < container.size; i++) {
            if (!container.getItem(i)) {
                return true;
            }
        }

        return false;
    }
}
