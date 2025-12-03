import { world, system } from "@minecraft/server";
import { Config } from "../config";

system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        if (player.hasTag(Config.STAFF_MODE_TAG)) {
            player.runCommandAsync("gamemode spectator @s");
            player.onScreenDisplay.setActionBar("§8[§fMODO STAFF§8]");
        }
    }
}, 20);