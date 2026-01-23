import { world, system } from "@minecraft/server";
import { JetpackSystem } from "./jetpack/jetpack.system";
import { AngelSystem } from "./angel/angel.system";

// Main tick loop
system.runInterval(() => {
    // Iterate all players
    for (const player of world.getPlayers()) {
        try {
            JetpackSystem.tick(player);
            AngelSystem.tick(player);
        } catch (e) {
            // Prevent crash if player leaves or invalid state
        }
    }
});

// Item use listener
world.afterEvents.itemUse.subscribe((event) => {
    JetpackSystem.onUse(event);
    AngelSystem.onUse(event);
});

world.afterEvents.worldInitialize.subscribe(() => {
    console.warn("Jetpacks & Angel Ring Addon Loaded!");
});
