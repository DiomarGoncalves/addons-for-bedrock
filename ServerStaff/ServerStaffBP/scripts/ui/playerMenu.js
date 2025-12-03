
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Config } from "../config";

export function openPlayerMenu(staff, target) {
    const isBanned = target.hasTag(Config.BAN_TAG);
    const isJailed = target.hasTag(Config.JAIL_TAG);
    const isMuted = target.hasTag(Config.MUTE_TAG);
    const isFrozen = target.hasTag(Config.FREEZE_TAG);
    const isStaffMode = target.hasTag(Config.STAFF_MODE_TAG);
    const isGod = target.hasTag(Config.GOD_TAG);

    // Inspeção de Inventário Simples
    let invText = "§7Vazio";
    const inventory = target.getComponent("inventory");
    if (inventory && inventory.container) {
        const items = [];
        for (let i = 0; i < inventory.container.size; i++) {
            const item = inventory.container.getItem(i);
            if (item) {
                items.push(`§8- §f${item.typeId.replace("minecraft:", "")} x${item.amount}`);
            }
        }
        if (items.length > 0) invText = items.slice(0, 8).join("\n") + (items.length > 8 ? "\n§7..." : "");
    }

    const form = new ActionFormData()
        .title(`§8Player: §f${target.name}`)
        .body(`§7Vida: §f${Math.round(target.getComponent("health").currentValue)}\n§7Inventario (Topo):\n${invText}`)
        .button("§8Teleportar Para")
        .button("§8Trazer Player")
        .button(isFrozen ? "§fDescongelar" : "§8Congelar")
        .button(isBanned ? "§fDesbanir" : "§8Banir")
        .button(isJailed ? "§fSoltar da Jaula" : "§8Prender na Jaula")
        .button(isMuted ? "§fDesmutar" : "§8Mutar")
        .button("§8Limpar Inventario")
        .button(isStaffMode ? "§fStaff Mode: ON" : "§8Staff Mode: OFF")
        .button(isGod ? "§fGod Mode: ON" : "§8God Mode: OFF")
        .button("§8KICKAR");

    form.show(staff).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: // TP To
                staff.teleport(target.location, { dimension: target.dimension });
                staff.sendMessage(`${Config.PREFIX} Teleportado para ${target.name}`);
                break;
            case 1: // TP Here
                target.teleport(staff.location, { dimension: staff.dimension });
                staff.sendMessage(`${Config.PREFIX} Puxou ${target.name}`);
                break;
            case 2: // Freeze
                if (isFrozen) {
                    target.removeTag(Config.FREEZE_TAG);
                    staff.sendMessage(`${Config.PREFIX} Descongelado.`);
                } else {
                    target.addTag(Config.FREEZE_TAG);
                    staff.sendMessage(`${Config.PREFIX} Congelado.`);
                }
                break;
            case 3: // Ban
                if (isBanned) {
                    target.removeTag(Config.BAN_TAG);
                    target.teleport(world.getDefaultSpawnLocation(), { dimension: world.getDimension("overworld")});
                    target.runCommandAsync("gamemode survival @s");
                    target.runCommandAsync("effect @s blindness 0 0 true");
                    staff.sendMessage(`${Config.PREFIX} Desbanido.`);
                } else {
                    target.addTag(Config.BAN_TAG);
                    staff.sendMessage(`${Config.PREFIX} Banido.`);
                }
                break;
            case 4: // Jail
                if (isJailed) {
                    target.removeTag(Config.JAIL_TAG);
                    target.teleport(world.getDefaultSpawnLocation(), { dimension: world.getDimension("overworld")});
                    target.runCommandAsync("gamemode survival @s");
                    staff.sendMessage(`${Config.PREFIX} Solto da jaula.`);
                } else {
                    target.addTag(Config.JAIL_TAG);
                    staff.sendMessage(`${Config.PREFIX} Preso na jaula.`);
                }
                break;
            case 5: // Mute
                if (isMuted) {
                    target.removeTag(Config.MUTE_TAG);
                    staff.sendMessage(`${Config.PREFIX} Desmutado.`);
                } else {
                    target.addTag(Config.MUTE_TAG);
                    staff.sendMessage(`${Config.PREFIX} Mutado.`);
                }
                break;
            case 6: // Clear Inv
                target.runCommandAsync("clear @s");
                staff.sendMessage(`${Config.PREFIX} Inventario limpo.`);
                break;
            case 7: // Staff Mode
                if (isStaffMode) {
                    target.removeTag(Config.STAFF_MODE_TAG);
                    target.runCommandAsync("gamemode survival @s");
                    staff.sendMessage(`${Config.PREFIX} StaffMode OFF.`);
                } else {
                    target.addTag(Config.STAFF_MODE_TAG);
                    staff.sendMessage(`${Config.PREFIX} StaffMode ON.`);
                }
                break;
            case 8: // God Mode
                if (isGod) {
                    target.removeTag(Config.GOD_TAG);
                    staff.sendMessage(`${Config.PREFIX} GodMode OFF.`);
                } else {
                    target.addTag(Config.GOD_TAG);
                    staff.sendMessage(`${Config.PREFIX} GodMode ON.`);
                }
                break;
            case 9: // Kick
                const tName = target.name;
                staff.runCommandAsync(`kick "${tName}" Expulso pelo Staff`);
                break;
        }
    });
}