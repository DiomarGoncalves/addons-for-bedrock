import { system, world } from "@minecraft/server";
import { JetpackConfig } from "../jetpack/jetpack.config";
import { InventoryUtils } from "../shared/inventory.utils";
import { PlayerState } from "../shared/state.store";

const TAG_FLY = "custom:AngelMayfly";

function isCreativeLike(mode) {
    return mode === "creative" || mode === "spectator";
}

function setMayfly(player, enabled) {
    try {
        player.runCommand("gamerule sendcommandfeedback false");
        player.runCommand("gamerule commandblockoutput false"); 
        player.runCommand("ability @s mayfly true");
    } catch (_) { }
}

export class AngelSystem {
    static tick(_player) { }

    static onUse(event) {
        const player = event.source;
        const item = event.itemStack;

        if (item?.typeId !== JetpackConfig.angelRing.identifier) return;

        const isActive = PlayerState.isAngelRingActive(player.id);
        const newState = !isActive;
        PlayerState.setAngelRingActive(player.id, newState);

        const color = newState ? "§a" : "§c";
        player.onScreenDisplay.setActionBar(`Angel Ring: ${color}${newState ? "ON" : "OFF"}`);
        player.playSound("random.click");
    }

    static register() {
        world.afterEvents.itemUse.subscribe((ev) => this.onUse(ev));
    }
}

// ==========================================
// VOO NATIVO (MAYFLY) - ANGEL RING
// ==========================================
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const mode = player.getGameMode();

        const chest = InventoryUtils.getEquippedChestplate(player);
        const hasAngelEquipped = chest?.typeId === JetpackConfig.angelRing.identifier;

        const toggledOn = PlayerState.isAngelRingActive(player.id);
        let shouldFly = hasAngelEquipped && toggledOn;

        // Fuel Check
        if (shouldFly && !isCreativeLike(mode)) {
            const config = JetpackConfig.angelRing;
            // Config fuelRate is 200000 (very high), but we check anyway
            // We use interval 5, so we need to make sure fuelRate is divisible by 5 or check differently.
            // 200000 is divisible by 5.
            if (system.currentTick % config.fuelRate === 0) {
                if (!InventoryUtils.consumeFuel(player)) {
                    // Out of fuel
                    PlayerState.setAngelRingActive(player.id, false);
                    player.onScreenDisplay.setActionBar("Angel Ring: OFF (No Fuel!)");
                    player.playSound("random.break");
                    shouldFly = false;
                }
            }
        }

        const hasTag = player.hasTag(TAG_FLY);

        // Liga
        if (shouldFly && !hasTag) {
            setMayfly(player, true);
            player.addTag(TAG_FLY);
        }

        // Desliga (não mexe em creative/spectator)
        if (!shouldFly && hasTag && !isCreativeLike(mode)) {
            setMayfly(player, false);
            player.removeTag(TAG_FLY);
        }

        // Se entrou em creative/spectator, não deixa tag “sujar estado”
        if (hasTag && isCreativeLike(mode)) {
            player.removeTag(TAG_FLY);
        }
    }
}, 5); // Run every 5 ticks to catch fuel rates (multiples of 10) accurately without missing
