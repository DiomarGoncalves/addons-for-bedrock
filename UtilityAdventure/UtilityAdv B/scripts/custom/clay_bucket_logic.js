// clay_bucket_logic.js

import { world, ItemStack, Player } from "@minecraft/server";

const ComponentId = "claybucket:clay_bucket";

//** Unknown Mcpe**//

const EmptyBucketId = "claybucket:clay_bucket";
const LavaFillSound = "bucket.fill_lava";
const LavaEmptySound = "bucket.empty_lava";
const WaterFillSound = "bucket.fill_water";
const WaterEmptySound = "bucket.empty_water";

class ClayBucket {
    constructor(block, item, player, blockFace) {
        this.block = block;
        this.item = item;
        this.player = player;
        this.blockFace = blockFace;
        this.inv = player.getComponent("inventory").container;
    }

    playSound(id) {
        this.player.dimension.playSound(id, this.player.location);
    }

    isBucketEmpty() {
        return this.item.typeId === EmptyBucketId;
    }

    isBucketFull() {
        const id = this.item.typeId;
        return id.includes("water") || id.includes("lava");
    }

    getFluidTypeFromItem() {
        if (this.item.typeId.includes("water")) return "minecraft:water";
        if (this.item.typeId.includes("lava")) return "minecraft:lava";
        return null;
    }

    blockFaceVector() {
        switch (this.blockFace) {
            case "Up": return { x: 0, y: 1, z: 0 };
            case "Down": return { x: 0, y: -1, z: 0 };
            case "North": return { x: 0, y: 0, z: -1 };
            case "South": return { x: 0, y: 0, z: 1 };
            case "East": return { x: 1, y: 0, z: 0 };
            case "West": return { x: -1, y: 0, z: 0 };
            default: return { x: 0, y: 1, z: 0 };
        }
    }

    replaceItem(newId) {
        const newItem = new ItemStack(newId, 1);
        const slot = this.player.selectedSlotIndex;
        const current = this.inv.getItem(slot);
        if (current.amount > 1) {
            this.inv.addItem(newItem);
            current.amount -= 1;
            this.inv.setItem(slot, current);
        } else {
            this.inv.setItem(slot, newItem);
        }
    }

    addFluidToBucket(fluidId) {
        if (this.isBucketFull()) return;

        if (fluidId.includes("lava")) {
            this.replaceItem("claybucket:clay_bucket_lava");
            this.playSound(LavaFillSound);
        } else {
            this.replaceItem("claybucket:clay_bucket_water");
            this.playSound(WaterFillSound);
        }
    }

    removeFluidFromBucket() {
        if (this.isBucketEmpty()) return;

        this.replaceItem(EmptyBucketId);
    }

    tryCollectFluid() {
        if (!this.block.isLiquid) return false;
       if (!this.isBucketEmpty()) return false;
        const state = this.block.permutation.getAllStates();
        if (state.liquid_depth !== 0) return false;

        const type = this.block.typeId;
        if (type === "minecraft:water") {
      //  console.log("colect water")          
            this.block.setType("minecraft:air");
            this.addFluidToBucket("minecraft:water");
              
            return true;
        }
        if (type === "minecraft:lava") {
            this.block.setType("minecraft:air");
            this.addFluidToBucket("minecraft:lava");
            return true;
        }
        return false;
    }

    tryPlaceFluid() {
        if (this.isBucketEmpty()) return false;
        const fluidType = this.getFluidTypeFromItem();
        if (!fluidType) return false;

        const targetBlock = this.block;
        const state = targetBlock.permutation.getAllStates();
        const isLiquid = targetBlock.isLiquid;
        const isSolid = !isLiquid && targetBlock.typeId !== "minecraft:air";

        let placeLoc = { ...targetBlock.location };

        if (isSolid) {
            const offset = this.blockFaceVector();
            placeLoc = {
                x: targetBlock.location.x + offset.x,
                y: targetBlock.location.y + offset.y,
                z: targetBlock.location.z + offset.z
            };
        } else if (isLiquid) {
            const depth = state.liquid_depth ?? 0;
            if (depth === 0 && targetBlock.typeId === fluidType) return false;
        }

        const placeBlock = this.player.dimension.getBlock(placeLoc);
        if (!placeBlock) return false;

        const canReplace =
            placeBlock.typeId === "minecraft:air" ||
            (placeBlock.isLiquid &&
                placeBlock.permutation.getAllStates().liquid_depth > 0);

        if (!canReplace) return false;

        placeBlock.setType(`minecraft:flowing_${fluidType.split(":")[1]}`);
        this.removeFluidFromBucket();
        this.playSound(fluidType.includes("lava") ? LavaEmptySound : WaterEmptySound);
        const slot = this.player.selectedSlotIndex;
        const current = this.inv.getItem(slot);
        fluidType.includes("lava") ? this.inv.setItem(slot, undefined) : null;
        return true;
    }
}

world.afterEvents.itemUse.subscribe(ev => {
    const { itemStack, source } = ev;
    if (!(source instanceof Player)) return;
    if (!itemStack.hasTag(ComponentId)) return;

    const dir = source.getBlockFromViewDirection({ maxDistance: 15, includeLiquidBlocks: true });
    if (!dir || !dir.block.isValid) return;

    const bucket = new ClayBucket(dir.block, itemStack, source, dir.face);

    // collect first
    if (bucket.tryCollectFluid()) return;

    // else try place
    bucket.tryPlaceFluid();
});