import { system, world } from "@minecraft/server";
import { JetpackConfig } from "./jetpack.config";
import { InventoryUtils } from "../shared/inventory.utils";
import { PlayerState } from "../shared/state.store";

const TAG_FLY = "custom:JetpackMayfly";

function isCreativeLike(mode) {
    return mode === "creative" || mode === "spectator";
}

function setMayfly(player, enabled) {
    try {
        player.runCommandAsync(`ability @s mayfly ${enabled ? "true" : "false"}`);
    } catch (_) { }
}

export class JetpackSystem {
    static tick(_player) { }

    static onUse(event) {
        const player = event.source;
        const item = event.itemStack;

        if (!JetpackConfig.tiers[item.typeId]) return;

        const isActive = PlayerState.isJetpackActive(player.id);
        const newState = !isActive;
        PlayerState.setJetpackActive(player.id, newState);

        const color = newState ? "§a" : "§c";
        player.onScreenDisplay.setActionBar(`Jetpack: ${color}${newState ? "ON" : "OFF"}`);
        player.playSound("random.click");
    }
}

// ==========================================
// VOO NATIVO (MAYFLY) - JETPACK
// ==========================================
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const mode = player.getGameMode();

        const chest = InventoryUtils.getEquippedChestplate(player);
        const jetpackTier = chest ? JetpackConfig.tiers[chest.typeId] : undefined;
        const hasJetpackEquipped = !!jetpackTier;

        const toggledOn = PlayerState.isJetpackActive(player.id);
        let shouldFly = hasJetpackEquipped && toggledOn;

        // Fuel Check
        if (shouldFly && !isCreativeLike(mode)) {
            // Check fuel based on tier rate
            if (system.currentTick % jetpackTier.fuelRate === 0) {
                if (!InventoryUtils.consumeFuel(player)) {
                    // Out of fuel
                    PlayerState.setJetpackActive(player.id, false);
                    player.onScreenDisplay.setActionBar("Jetpack: OFF (No Fuel!)");
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
}, 1); // Run every tick to catch fuel rates accurately (some might be odd numbers?) 
// Actually user said "teoricamente uma hora para", implying fuel runs out.
// Previous interval was 10. Fuel rates are 40, 60, etc.
// If we run at 10, we might miss the exact tick % rate === 0 if rate is not multiple of 10?
// But config rates are 40, 60, 70, 90, 110, 140, 180. All multiples of 10.
// So interval 10 is fine and better for perf.
// However, to be safe and responsive, let's use 1 or 2?
// User snippet used 10. I'll stick to 10 but ensure logic works.
// Wait, if I use 10, and currentTick is 45, 45 % 40 != 0.
// Next run is 55. 55 % 40 != 0.
// We might miss the fuel tick entirely if we check `currentTick % rate === 0` inside an interval.
// BETTER APPROACH: Store last fuel tick or just decrement a counter?
// OR: Just run every tick (interval 1) but it might be heavy?
// OR: Logic: `if (system.currentTick % jetpackTier.fuelRate < 10)` ? No.
// Let's just run interval 1 for Jetpacks to be safe with fuel, or change logic to not depend on exact tick modulo.
// Actually, let's use interval 5. 40%5==0. 60%5==0. 70%5==0. All rates are divisible by 5.
// So if we run every 5 ticks, we will hit the exact tick.
