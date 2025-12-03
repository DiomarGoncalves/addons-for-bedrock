import { world, system } from "@minecraft/server";
import { Config } from "./config";
import { openMainMenu } from "./ui/mainMenu";

import "./features/ban";
import "./features/jail";
import "./features/mute";
import "./features/staffMode";
import "./features/freeze";

// Maintenance and God Mode Logic loop
system.runInterval(() => {
    const players = world.getAllPlayers();
    const isMaintenance = world.getDynamicProperty(Config.MAINTENANCE_TAG);

    for (const player of players) {
        // Maintenance Enforcement
        if (isMaintenance && !player.hasTag(Config.STAFF_TAG)) {
            player.runCommandAsync("kick @s Servidor em Manutencao");
        }

        // God Mode Enforcement (Apenas efeitos, sem ability)
        if (player.hasTag(Config.GOD_TAG)) {
            player.runCommandAsync("effect @s instant_health 1 255 true");
            player.runCommandAsync("effect @s saturation 1 255 true");
            player.runCommandAsync("effect @s resistance 1 255 true");
            player.runCommandAsync("effect @s fire_resistance 1 255 true");
        }
    }
}, 20);

world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (item.typeId === Config.STAFF_ITEM_ID) {
        event.cancel = true;

        if (!player.hasTag(Config.STAFF_TAG)) {
            player.sendMessage(Config.NO_PERM);
            return;
        }

        system.run(() => {
            openMainMenu(player);
        });
    }
});