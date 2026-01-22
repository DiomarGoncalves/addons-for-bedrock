import { world, ItemStack, Player } from "@minecraft/server";

const ComponentId = "fluidcells:fluidCell";
const EmptyCellId = "fluidcells:empty_cell";
const LavaFillSound = "bucket.fill_lava";
const LavaEmptySound = "bucket.empty_lava";
const WaterFillSound = "bucket.fill_water";
const WaterEmptySound = "bucket.empty_water";
class FluidCell {
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
    
    isItemFull() {
        const id = this.item.typeId;
        return id.endsWith("_cell") && !id.includes("empty");
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

    replaceOrAddItem(newId) {
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

    addFluidToItem(itemId, fluidId) {
        if (this.isItemFull()) return;

        const parts = itemId.split("_");
        const level = Number(parts[parts.length - 1]);

        if (!isNaN(level)) {
            if (level === 1) {
                const newItem = `fluidcells:${fluidId.split(":")[1]}_cell`;
                this.replaceOrAddItem(newItem);
            } else {
                const newItem = itemId.replace(`_${level}`, `_${level - 1}`);
                this.replaceOrAddItem(newItem);
            }
        } else if (itemId === EmptyCellId) {
            const newItem = `fluidcells:${fluidId.split(":")[1]}_cell_3`;
            this.replaceOrAddItem(newItem);
        }

        if (fluidId.includes("lava")) this.playSound(LavaFillSound);
        else this.playSound(WaterFillSound);
    }

    tryCollectFluid() {
        if (!this.block.isLiquid) return false;
        if (this.isItemFull()) return false;

        const state = this.block.permutation.getAllStates();
        if (state.liquid_depth !== 0) return false;

        const type = this.block.typeId;
        const itemType = this.getFluidTypeFromItem();

        // EMPTY CELL
        if (this.item.typeId === EmptyCellId) {
            if (type === "minecraft:water") {
                this.block.setType("minecraft:air");
                this.addFluidToItem(this.item.typeId, "minecraft:water");
                this.playSound(WaterFillSound);
                return true;
            }
            if (type === "minecraft:lava") {
                this.block.setType("minecraft:air");
                this.addFluidToItem(this.item.typeId, "minecraft:lava");
                this.playSound(LavaFillSound);
                return true;
            }
        }

        else {
            if (type === "minecraft:water" && itemType === "minecraft:water") {
                this.block.setType("minecraft:air");
                this.addFluidToItem(this.item.typeId, "minecraft:water");
                this.playSound(WaterFillSound);
                return true;
            }
            if (type === "minecraft:lava" && itemType === "minecraft:lava") {
                this.block.setType("minecraft:air");
                this.addFluidToItem(this.item.typeId, "minecraft:lava");
                this.playSound(LavaFillSound);
                return true;
            }
        }

        return false;
    }

    tryPlaceFluid() {
        if (this.item.typeId === EmptyCellId) return false;

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
        }

        else if (isLiquid) {
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

        this.removeFluidToItem();
        this.playSound(fluidType.includes("lava") ? LavaEmptySound : WaterEmptySound);

        return true;
    }

    removeFluidToItem() {
        const id = this.item.typeId;
        const parts = id.split("_");
        const level = Number(parts[parts.length - 1]);

        if (!isNaN(level)) {
            if (level === 3) {
                this.replaceOrAddItem("fluidcells:empty_cell");
            } else {
                this.replaceOrAddItem(id.replace(`_${level}`, `_${level + 1}`));
            }
        } else {
            const type = id.includes("lava") ? "lava" : "water";
            this.replaceOrAddItem(`fluidcells:${type}_cell_1`);
        }
    }
}

world.afterEvents.itemUse.subscribe(ev => {
    const { itemStack, source } = ev;

    if (!(source instanceof Player)) return;
    if (!itemStack.hasTag(ComponentId)) return;

    const dir = source.getBlockFromViewDirection({
        maxDistance: 15,
        includeLiquidBlocks: true
    });

    if (!dir || !dir.block?.isValid) return;

    const cell = new FluidCell(dir.block, itemStack, source, dir.face);

    if (cell.tryCollectFluid()) return;

    cell.tryPlaceFluid();
});