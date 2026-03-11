import { world, system, ItemStack } from"@minecraft/server";

const GeneratorConfig = {
    // Basic Generators - Common to Rare
    "blayy:basic_generator_dirt": { isBasic: true, spawnblock:"minecraft:dirt", chance: 0.25 },
    "blayy:basic_generator_clay": { isBasic: true, spawnblock:"minecraft:clay", chance: 0.25 },
    "blayy:basic_generator_sand": { isBasic: true, spawnblock:"minecraft:sand", chance: 0.25 },
    "blayy:basic_generator_gravel": { isBasic: true, spawnblock:"minecraft:gravel", chance: 0.25 },
    "blayy:basic_generator_cobblestone": { isBasic: true, spawnblock:"minecraft:cobblestone", chance: 0.25 },
    "blayy:basic_generator_netherrack": { isBasic: true, spawnblock:"minecraft:netherrack", chance: 0.25 },
    "blayy:basic_generator_coal": { isBasic: true, spawnblock:"minecraft:coal_ore", chance: 0.2 },
    "blayy:basic_generator_copper": { isBasic: true, spawnblock:"minecraft:copper_ore", chance: 0.1 },
    "blayy:basic_generator_iron": { isBasic: true, spawnblock:"minecraft:iron_ore", chance: 0.09 },
    "blayy:basic_generator_gold": { isBasic: true, spawnblock:"minecraft:gold_ore", chance: 0.06 },
    "blayy:basic_generator_redstone": { isBasic: true, spawnblock:"minecraft:redstone_ore", chance: 0.1 },
    "blayy:basic_generator_lapis": { isBasic: true, spawnblock:"minecraft:lapis_ore", chance: 0.075 },
    "blayy:basic_generator_diamond": { isBasic: true, spawnblock:"minecraft:diamond_ore", chance: 0.05 },
    "blayy:basic_generator_emerald": { isBasic: true, spawnblock:"minecraft:emerald_ore", chance: 0.0375 },
    "blayy:basic_generator_amethyst": { isBasic: true, spawnblock:"minecraft:amethyst_cluster", chance: 0.1 },
    "blayy:basic_generator_netherite": { isBasic: true, spawnblock:"minecraft:ancient_debris", chance: 0.0125 },
    "blayy:basic_generator_quartz": { isBasic: true, spawnblock:"minecraft:quartz_ore", chance: 0.1 },
    
    // Advanced Generators (same chances)
    "blayy:advanced_generator_dirt": { isBasic: false, spawnblock:"minecraft:dirt", chance: 0.25 },
    "blayy:advanced_generator_clay": { isBasic: false, spawnblock:"minecraft:clay", chance: 0.25 },
    "blayy:advanced_generator_sand": { isBasic: false, spawnblock:"minecraft:sand", chance: 0.25 },
    "blayy:advanced_generator_gravel": { isBasic: false, spawnblock:"minecraft:gravel", chance: 0.25 },
    "blayy:advanced_generator_netherrack": { isBasic: false, spawnblock:"minecraft:netherrack", chance: 0.25 },
    "blayy:advanced_generator_cobblestone": { isBasic: false, spawnblock:"minecraft:cobblestone", chance: 0.25 },
    "blayy:advanced_generator_coal": { isBasic: false, spawnblock:"minecraft:coal", chance: 0.2 },
    "blayy:advanced_generator_copper": { isBasic: false, spawnblock:"minecraft:raw_copper", chance: 0.1 },
    "blayy:advanced_generator_iron": { isBasic: false, spawnblock:"minecraft:raw_iron", chance: 0.09 },
    "blayy:advanced_generator_gold": { isBasic: false, spawnblock:"minecraft:raw_gold", chance: 0.06 },
    "blayy:advanced_generator_redstone": { isBasic: false, spawnblock:"minecraft:redstone", chance: 0.1 },
    "blayy:advanced_generator_lapis": { isBasic: false, spawnblock:"minecraft:lapis_lazuli", chance: 0.075 },
    "blayy:advanced_generator_diamond": { isBasic: false, spawnblock:"minecraft:diamond", chance: 0.05 },
    "blayy:advanced_generator_emerald": { isBasic: false, spawnblock:"minecraft:emerald", chance: 0.0375 },
    "blayy:advanced_generator_amethyst": { isBasic: false, spawnblock:"minecraft:amethyst_shard", chance: 0.1 },
    "blayy:advanced_generator_netherite": { isBasic: false, spawnblock:"minecraft:netherite_scrap", chance: 0.0125 },
    "blayy:advanced_generator_quartz": { isBasic: false, spawnblock:"minecraft:quartz", chance: 0.1 }
 };

 const generatorTick = {
    onTick({ block }) {
        const config = GeneratorConfig[block.typeId];
        if (!config || Math.random() > config.chance) return;
 
        const { x, y, z } = block.location;
        const aboveBlock = block.dimension.getBlock({ x, y: y + 1, z });
        
        if (config.isBasic) {
            if (aboveBlock?.typeId === "minecraft:air") {
                aboveBlock.setType(config.spawnblock); 
            }
        } else {
            const itemStack = new ItemStack(config.spawnblock, 1);
            const spawnedItem = block.dimension.spawnItem(itemStack, { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
            spawnedItem.clearVelocity();
        }
    }
 };

world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(
        "blayy:generator_tick",
        generatorTick
    );
});