import { world, system } from "@minecraft/server";
import { Config } from "../config";

// Run every 20 ticks (1 second)
system.runInterval(() => {
    const players = world.getAllPlayers();
    const jailDim = world.getDimension("overworld");

    for (const player of players) {
        if (player.hasTag(Config.BAN_TAG)) {
            const { x, y, z } = Config.JAIL_COORDINATES;

            // Ensure player stays at bedrock box location
            // We use slightly different logic than Jail, ensuring they can't move at all
            const dist = Math.sqrt(
                Math.pow(player.location.x - x, 2) +
                Math.pow(player.location.y - y, 2) +
                Math.pow(player.location.z - z, 2)
            );

            if (dist > 3 || player.dimension.id !== jailDim.id) {
                player.teleport({ x: x + 0.5, y: y + 1, z: z + 0.5 }, { dimension: jailDim });
            }
            
            // Force adventure mode so they can't break blocks
            player.runCommandAsync("gamemode adventure @s");
            // Blindness ensures they can't see coords or surroundings clearly
            player.runCommandAsync("effect @s blindness 2 255 true");
        }
    }
}, 20);