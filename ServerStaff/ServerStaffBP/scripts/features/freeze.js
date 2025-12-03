import { world, system } from "@minecraft/server";
import { Config } from "../config";

system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        if (player.hasTag(Config.FREEZE_TAG)) {
            player.teleport(player.location, {
                dimension: player.dimension,
                rotation: { x: 0, y: 0 }
            });
            
            player.onScreenDisplay.setActionBar("§fCONGELADO PELO STAFF");
        }
    }
}, 5);