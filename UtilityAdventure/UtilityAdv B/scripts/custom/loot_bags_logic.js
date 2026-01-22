import { system, world, ItemStack, GameMode, EntityComponentTypes, EquipmentSlot } from "@minecraft/server";
import { lootBagList } from "./lootBagList";
import { LootPools } from "./loot_bags_random_loot";

const COMMON_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs"
];
const UNCOMMON_POOL = [
  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:arrow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat"
];
const RARE_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs",

  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil","holycloud:angelic_feather",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat",

  "minecraft:diamond","minecraft:diamond_block","minecraft:diamond_ore","minecraft:deepslate_diamond_ore",
  "minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:diamond_shovel","minecraft:diamond_hoe",
  "minecraft:diamond_sword","minecraft:diamond_helmet","minecraft:diamond_chestplate",
  "minecraft:diamond_leggings","minecraft:diamond_boots",
  "minecraft:emerald","minecraft:emerald_block","minecraft:emerald_ore","minecraft:deepslate_emerald_ore",
  "minecraft:trident","minecraft:heart_of_the_sea","minecraft:conduit",
  "minecraft:nautilus_shell","minecraft:shulker_shell","minecraft:shulker_box",
  "minecraft:ender_chest","minecraft:totem_of_undying",
  "minecraft:enchanted_golden_apple",
  "minecraft:ancient_debris","minecraft:netherite_scrap",
  "minecraft:lodestone","minecraft:lodestone_compass",
  "minecraft:beacon","minecraft:phantom_membrane",
  "minecraft:nether_quartz","minecraft:quartz_block",
  "minecraft:respawn_anchor",
  "minecraft:sculk","minecraft:sculk_sensor","minecraft:sculk_shrieker",
  "minecraft:amethyst_shard","minecraft:amethyst_block","cloudrelic:knowledge_seeker",
  "minecraft:budding_amethyst"
];
const EPIC_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs",

  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map","holycloud:angelic_feather",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat",

  "minecraft:diamond","minecraft:diamond_block","minecraft:diamond_ore","minecraft:deepslate_diamond_ore",
  "minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:diamond_shovel","minecraft:diamond_hoe",
  "minecraft:diamond_sword","minecraft:diamond_helmet","minecraft:diamond_chestplate",
  "minecraft:diamond_leggings","minecraft:diamond_boots",
  "minecraft:emerald","minecraft:emerald_block","minecraft:emerald_ore","minecraft:deepslate_emerald_ore",
  "minecraft:trident","minecraft:heart_of_the_sea","minecraft:conduit",
  "minecraft:nautilus_shell","minecraft:shulker_shell","minecraft:shulker_box",
  "minecraft:ender_chest","minecraft:totem_of_undying",
  "minecraft:enchanted_golden_apple",
  "minecraft:ancient_debris","minecraft:netherite_scrap",
  "minecraft:lodestone","minecraft:lodestone_compass",
  "minecraft:beacon","minecraft:phantom_membrane",
  "minecraft:nether_quartz","minecraft:quartz_block",
  "minecraft:respawn_anchor",
  "minecraft:sculk","minecraft:sculk_sensor","minecraft:sculk_shrieker",
  "minecraft:amethyst_shard","minecraft:amethyst_block",
  "minecraft:budding_amethyst",

  "minecraft:netherite_ingot","minecraft:netherite_block",
  "minecraft:netherite_pickaxe","minecraft:netherite_axe",
  "minecraft:netherite_shovel","minecraft:netherite_hoe",
  "minecraft:netherite_sword",
  "minecraft:netherite_helmet","minecraft:netherite_chestplate",
  "minecraft:netherite_leggings","minecraft:netherite_boots",
  "minecraft:elytra","minecraft:nether_star",
  "minecraft:wither_skeleton_skull","minecraft:end_crystal",
  "minecraft:dragon_breath",
  "minecraft:music_disc_pigstep","minecraft:music_disc_otherside",
  "minecraft:reinforced_deepslate","minecraft:sniffer_egg",
  "minecraft:archer_pottery_sherd","minecraft:arms_up_pottery_sherd",
  "minecraft:brewer_pottery_sherd","minecraft:burn_pottery_sherd","cloudrelic:knowledge_seeker",
  "minecraft:danger_pottery_sherd","minecraft:explorer_pottery_sherd",
  "minecraft:friend_pottery_sherd","minecraft:heart_pottery_sherd",
  "minecraft:howl_pottery_sherd","minecraft:miner_pottery_sherd",
  "minecraft:mourner_pottery_sherd","minecraft:plenty_pottery_sherd",
  "minecraft:prize_pottery_sherd","minecraft:sheaf_pottery_sherd",
  "minecraft:shelter_pottery_sherd","minecraft:skull_pottery_sherd",
  "minecraft:snort_pottery_sherd"
];
const LEGENDARY_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs",

  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe","holycloud:angelic_feather",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat",

  "minecraft:diamond","minecraft:diamond_block","minecraft:diamond_ore","minecraft:deepslate_diamond_ore",
  "minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:diamond_shovel","minecraft:diamond_hoe",
  "minecraft:diamond_sword","minecraft:diamond_helmet","minecraft:diamond_chestplate",
  "minecraft:diamond_leggings","minecraft:diamond_boots",
  "minecraft:emerald","minecraft:emerald_block","minecraft:emerald_ore","minecraft:deepslate_emerald_ore",
  "minecraft:trident","minecraft:heart_of_the_sea","minecraft:conduit",
  "minecraft:nautilus_shell","minecraft:shulker_shell","minecraft:shulker_box",
  "minecraft:ender_chest","minecraft:totem_of_undying",
  "minecraft:enchanted_golden_apple",
  "minecraft:ancient_debris","minecraft:netherite_scrap",
  "minecraft:lodestone","minecraft:lodestone_compass",
  "minecraft:beacon","minecraft:phantom_membrane",
  "minecraft:nether_quartz","minecraft:quartz_block",
  "minecraft:respawn_anchor",
  "minecraft:sculk","minecraft:sculk_sensor","minecraft:sculk_shrieker",
  "minecraft:amethyst_shard","minecraft:amethyst_block",
  "minecraft:budding_amethyst",

  "minecraft:netherite_ingot","minecraft:netherite_block",
  "minecraft:netherite_pickaxe","minecraft:netherite_axe",
  "minecraft:netherite_shovel","minecraft:netherite_hoe",
  "minecraft:netherite_sword",
  "minecraft:netherite_helmet","minecraft:netherite_chestplate",
  "minecraft:netherite_leggings","minecraft:netherite_boots",
  "minecraft:elytra","minecraft:nether_star",
  "minecraft:wither_skeleton_skull","minecraft:end_crystal",
  "minecraft:dragon_breath",
  "minecraft:music_disc_pigstep","minecraft:music_disc_otherside",
  "minecraft:reinforced_deepslate","minecraft:sniffer_egg",
  "minecraft:archer_pottery_sherd","minecraft:arms_up_pottery_sherd",
  "minecraft:brewer_pottery_sherd","minecraft:burn_pottery_sherd",
  "minecraft:danger_pottery_sherd","minecraft:explorer_pottery_sherd",
  "minecraft:friend_pottery_sherd","minecraft:heart_pottery_sherd","cloudrelic:knowledge_seeker",
  "minecraft:howl_pottery_sherd","minecraft:miner_pottery_sherd",
  "minecraft:mourner_pottery_sherd","minecraft:plenty_pottery_sherd",
  "minecraft:prize_pottery_sherd","minecraft:sheaf_pottery_sherd",
  "minecraft:shelter_pottery_sherd","minecraft:skull_pottery_sherd","cloudham:infinite_ham",
  "minecraft:snort_pottery_sherd",
  "minecraft:dragon_egg"
];
const DIVINE_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot","cloudham:infinite_ham",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs",

  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper","holycloud:angelic_feather",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat",

  "minecraft:diamond","minecraft:diamond_block","minecraft:diamond_ore","minecraft:deepslate_diamond_ore",
  "minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:diamond_shovel","minecraft:diamond_hoe",
  "minecraft:diamond_sword","minecraft:diamond_helmet","minecraft:diamond_chestplate",
  "minecraft:diamond_leggings","minecraft:diamond_boots",
  "minecraft:emerald","minecraft:emerald_block","minecraft:emerald_ore","minecraft:deepslate_emerald_ore",
  "minecraft:trident","minecraft:heart_of_the_sea","minecraft:conduit",
  "minecraft:nautilus_shell","minecraft:shulker_shell","minecraft:shulker_box",
  "minecraft:ender_chest","minecraft:totem_of_undying",
  "minecraft:enchanted_golden_apple",
  "minecraft:ancient_debris","minecraft:netherite_scrap",
  "minecraft:lodestone","minecraft:lodestone_compass",
  "minecraft:beacon","minecraft:phantom_membrane",
  "minecraft:nether_quartz","minecraft:quartz_block",
  "minecraft:respawn_anchor",
  "minecraft:sculk","minecraft:sculk_sensor","minecraft:sculk_shrieker",
  "minecraft:amethyst_shard","minecraft:amethyst_block",
  "minecraft:budding_amethyst",

  "minecraft:netherite_ingot","minecraft:netherite_block",
  "minecraft:netherite_pickaxe","minecraft:netherite_axe",
  "minecraft:netherite_shovel","minecraft:netherite_hoe",
  "minecraft:netherite_sword",
  "minecraft:netherite_helmet","minecraft:netherite_chestplate",
  "minecraft:netherite_leggings","minecraft:netherite_boots",
  "minecraft:elytra","minecraft:nether_star",
  "minecraft:wither_skeleton_skull","minecraft:end_crystal",
  "minecraft:dragon_breath",
  "minecraft:music_disc_pigstep","minecraft:music_disc_otherside",
  "minecraft:reinforced_deepslate","minecraft:sniffer_egg",
  "minecraft:archer_pottery_sherd","minecraft:arms_up_pottery_sherd",
  "minecraft:brewer_pottery_sherd","minecraft:burn_pottery_sherd",
  "minecraft:danger_pottery_sherd","minecraft:explorer_pottery_sherd",
  "minecraft:friend_pottery_sherd","minecraft:heart_pottery_sherd","cloudrelic:knowledge_seeker",
  "minecraft:howl_pottery_sherd","minecraft:miner_pottery_sherd",
  "minecraft:mourner_pottery_sherd","minecraft:plenty_pottery_sherd",
  "minecraft:prize_pottery_sherd","minecraft:sheaf_pottery_sherd","holycloud:rending_gale",
  "minecraft:shelter_pottery_sherd","minecraft:skull_pottery_sherd",
  "minecraft:snort_pottery_sherd",
  "minecraft:dragon_egg"
];
const TRANSCENDENT_POOL = [
  "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:red_sand",
  "minecraft:gravel","minecraft:clay_ball","minecraft:oak_log","minecraft:spruce_log","minecraft:birch_log",
  "minecraft:jungle_log","minecraft:acacia_log","minecraft:dark_oak_log","minecraft:mangrove_log","minecraft:cherry_log",
  "minecraft:oak_planks","minecraft:spruce_planks","minecraft:birch_planks","minecraft:jungle_planks",
  "minecraft:acacia_planks","minecraft:dark_oak_planks","minecraft:mangrove_planks","minecraft:cherry_planks",
  "minecraft:oak_leaves","minecraft:spruce_leaves","minecraft:birch_leaves","minecraft:jungle_leaves",
  "minecraft:acacia_leaves","minecraft:dark_oak_leaves","minecraft:mangrove_leaves","minecraft:cherry_leaves",
  "minecraft:coal","minecraft:charcoal","minecraft:stick","minecraft:string","minecraft:feather","minecraft:flint",
  "minecraft:apple","minecraft:bread","minecraft:wheat","minecraft:wheat_seeds","minecraft:beetroot",
  "minecraft:beetroot_seeds","minecraft:carrot","minecraft:potato","minecraft:baked_potato",
  "minecraft:melon_slice","minecraft:pumpkin","minecraft:sugar_cane","minecraft:sugar",
  "minecraft:egg","minecraft:milk_bucket","minecraft:leather","minecraft:rotten_flesh","minecraft:bone",
  "minecraft:oak_sapling","minecraft:spruce_sapling","minecraft:birch_sapling","minecraft:jungle_sapling",
  "minecraft:acacia_sapling","minecraft:dark_oak_sapling","minecraft:mangrove_propagule","minecraft:cherry_sapling",
  "minecraft:torch","minecraft:crafting_table","minecraft:furnace","minecraft:chest","minecraft:barrel",
  "minecraft:ladder","minecraft:glass","minecraft:glass_pane","minecraft:oak_door","minecraft:oak_trapdoor",
  "minecraft:oak_fence","minecraft:oak_fence_gate","minecraft:stone_pickaxe","minecraft:stone_axe",
  "minecraft:stone_shovel","minecraft:stone_hoe","minecraft:wooden_pickaxe","minecraft:wooden_axe",
  "minecraft:wooden_shovel","minecraft:wooden_hoe","minecraft:bow","minecraft:arrow","minecraft:shield",
  "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
  "minecraft:iron_ingot","minecraft:iron_nugget","minecraft:iron_ore","minecraft:deepslate_iron_ore",
  "minecraft:gold_nugget","minecraft:copper_ingot","minecraft:copper_ore","minecraft:deepslate_copper_ore",
  "minecraft:raw_iron","minecraft:raw_copper","minecraft:raw_gold","minecraft:cobblestone_slab",
  "minecraft:cobblestone_stairs","minecraft:stone_slab","minecraft:stone_stairs",

  "minecraft:iron_pickaxe","minecraft:iron_axe","minecraft:iron_shovel","minecraft:iron_hoe",
  "minecraft:iron_sword","minecraft:iron_helmet","minecraft:iron_chestplate",
  "minecraft:iron_leggings","minecraft:iron_boots",
  "minecraft:chainmail_helmet","minecraft:chainmail_chestplate",
  "minecraft:chainmail_leggings","minecraft:chainmail_boots",
  "minecraft:redstone","minecraft:redstone_torch","minecraft:redstone_block",
  "minecraft:lever","minecraft:stone_button","minecraft:oak_button",
  "minecraft:observer","minecraft:piston","minecraft:sticky_piston",
  "minecraft:dispenser","minecraft:dropper","minecraft:hopper",
  "minecraft:comparator","minecraft:repeater",
  "minecraft:lapis_lazuli","minecraft:lapis_block",
  "minecraft:gold_ingot","minecraft:gold_ore","minecraft:deepslate_gold_ore",
  "minecraft:raw_gold","minecraft:golden_apple",
  "minecraft:copper_block","minecraft:cut_copper","minecraft:cut_copper_stairs",
  "minecraft:cut_copper_slab","minecraft:oxidized_copper",
  "minecraft:rail","minecraft:powered_rail","minecraft:detector_rail",
  "minecraft:activator_rail","minecraft:minecart","minecraft:chest_minecart",
  "minecraft:furnace_minecart","minecraft:hopper_minecart","minecraft:tnt_minecart",
  "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket",
  "minecraft:clock","minecraft:compass","minecraft:map",
  "minecraft:shears","minecraft:flint_and_steel",
  "minecraft:crossbow","minecraft:spectral_arrow",
  "minecraft:experience_bottle","minecraft:enchanted_book",
  "minecraft:cauldron","minecraft:brewing_stand","minecraft:blaze_powder",
  "minecraft:magma_cream","minecraft:ghast_tear",
  "minecraft:end_pearl","minecraft:ender_eye",
  "minecraft:bookshelf","minecraft:lectern",
  "minecraft:anvil","minecraft:chipped_anvil","minecraft:damaged_anvil",
  "minecraft:smithing_table","minecraft:grindstone","minecraft:loom",
  "minecraft:cartography_table","minecraft:fletching_table",
  "minecraft:trapped_chest","minecraft:iron_bars",
  "minecraft:lantern","minecraft:soul_lantern",
  "minecraft:campfire","minecraft:soul_campfire",
  "minecraft:bell","minecraft:scaffolding",
  "minecraft:tinted_glass","minecraft:spyglass",
  "minecraft:boat","minecraft:oak_boat","minecraft:spruce_boat",
  "minecraft:birch_boat","minecraft:jungle_boat",
  "minecraft:acacia_boat","minecraft:dark_oak_boat",
  "minecraft:mangrove_boat","minecraft:cherry_boat",

  "minecraft:diamond","minecraft:diamond_block","minecraft:diamond_ore","minecraft:deepslate_diamond_ore",
  "minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:diamond_shovel","minecraft:diamond_hoe",
  "minecraft:diamond_sword","minecraft:diamond_helmet","minecraft:diamond_chestplate","holycloud:angelic_feather",
  "minecraft:diamond_leggings","minecraft:diamond_boots",
  "minecraft:emerald","minecraft:emerald_block","minecraft:emerald_ore","minecraft:deepslate_emerald_ore",
  "minecraft:trident","minecraft:heart_of_the_sea","minecraft:conduit",
  "minecraft:nautilus_shell","minecraft:shulker_shell","minecraft:shulker_box",
  "minecraft:ender_chest","minecraft:totem_of_undying",
  "minecraft:enchanted_golden_apple",
  "minecraft:ancient_debris","minecraft:netherite_scrap",
  "minecraft:lodestone","minecraft:lodestone_compass",
  "minecraft:beacon","minecraft:phantom_membrane",
  "minecraft:nether_quartz","minecraft:quartz_block",
  "minecraft:respawn_anchor",
  "minecraft:sculk","minecraft:sculk_sensor","minecraft:sculk_shrieker",
  "minecraft:amethyst_shard","minecraft:amethyst_block",
  "minecraft:budding_amethyst",

  "minecraft:netherite_ingot","minecraft:netherite_block",
  "minecraft:netherite_pickaxe","minecraft:netherite_axe",
  "minecraft:netherite_shovel","minecraft:netherite_hoe",
  "minecraft:netherite_sword",
  "minecraft:netherite_helmet","minecraft:netherite_chestplate",
  "minecraft:netherite_leggings","minecraft:netherite_boots",
  "minecraft:elytra","minecraft:nether_star",
  "minecraft:wither_skeleton_skull","minecraft:end_crystal",
  "minecraft:dragon_breath",
  "minecraft:music_disc_pigstep","minecraft:music_disc_otherside",
  "minecraft:reinforced_deepslate","minecraft:sniffer_egg","cloudrelic:knowledge_seeker",
  "minecraft:archer_pottery_sherd","minecraft:arms_up_pottery_sherd",
  "minecraft:brewer_pottery_sherd","minecraft:burn_pottery_sherd",
  "minecraft:danger_pottery_sherd","minecraft:explorer_pottery_sherd",
  "minecraft:friend_pottery_sherd","minecraft:heart_pottery_sherd",
  "minecraft:howl_pottery_sherd","minecraft:miner_pottery_sherd",
  "minecraft:mourner_pottery_sherd","minecraft:plenty_pottery_sherd","holycloud:rending_gale",
  "minecraft:prize_pottery_sherd","minecraft:sheaf_pottery_sherd","cloudham:infinite_ham",
  "minecraft:shelter_pottery_sherd","minecraft:skull_pottery_sherd",
  "minecraft:snort_pottery_sherd",

  "minecraft:dragon_egg"
];
const TIER_POOLS = [
  COMMON_POOL,
  UNCOMMON_POOL,
  RARE_POOL,
  EPIC_POOL,
  LEGENDARY_POOL,
  DIVINE_POOL,
  TRANSCENDENT_POOL
];

function randInt(min, max) {
  min = Math.floor(min); max = Math.floor(max);
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTierFromBagId(itemId) {
  if (!itemId) return 1;
  for (let t = 0; t < lootBagList.length; t++) {
    const list = lootBagList[t] || [];
    for (const entry of list) {
      if (!entry || !entry.id) continue;
      if (entry.id === itemId) return t + 1;
      if (entry.id.endsWith(itemId.split(":").pop())) return t + 1;
    }
  }
  const name = itemId.toLowerCase();
  if (name.includes("common")) return 1;
  if (name.includes("uncommon")) return 2;
  if (name.includes("rare")) return 3;
  if (name.includes("epic")) return 4;
  if (name.includes("legendary")) return 5;
  if (name.includes("divine")) return 6;
  if (name.includes("transcendent")) return 7;
  return 1;
}

function createItemStackWithDamage(id, count, makeHalfBroken) {
  try {
    const stack = new ItemStack(id, count);
    try {
      const dur = stack.getComponent?.("minecraft:durability") ?? stack.getComponent?.("durability");
      if (dur && typeof (dur.maxDurability ?? dur.max) === "number" && makeHalfBroken) {
        const max = dur.maxDurability ?? dur.max ?? 100;
        const half = Math.floor(max / 2);
        if ("damage" in dur) dur.damage = half;
        else if ("currentDamage" in dur) dur.currentDamage = half;
      }
    } catch {}
    return stack;
  } catch {
    return null;
  }
}

function tryEnchantStackBestEffort(stack, tier) {
  try {
    const enchComp = stack.getComponent?.("minecraft:enchantments") ?? stack.getComponent?.("enchantments");
    if (!enchComp) return;
    const chance = Math.min(0.2, 0.02 * (tier + 1));
    if (Math.random() >= chance) return;
    if (!Array.isArray(enchComp.enchantments)) enchComp.enchantments = [];
    const level = Math.min(5, 1 + Math.floor(Math.random() * (tier + 1)));
    enchComp.enchantments.push({ id: "sharpness", level });
  } catch {}
}

function generateLootBagFromList(lootTier) {
  const table = lootBagList[lootTier - 1];
  if (!table) return null;
  const chance = Math.random() * 100;
  for (let i = 0; i < table.length; i++) {
    const loot = table[i];
    if (!loot) continue;
    if (chance < (loot.chance ?? 0)) {
      const count = randInt(1, loot.maxCount ?? 1);
      return new ItemStack(loot.id, count);
    }
  }
  return null;
}

function generateRandomForTier(tierIndex) {
  const tier = Math.max(0, Math.min(TIER_POOLS.length - 1, tierIndex - 1));
  const pool = TIER_POOLS[tier] ?? COMMON_POOL;
  if (Math.random() < (0.01 * (tier + 1))) {
    const candidate = pickFromArray(NEW_WEAPONS);
    return { id: candidate, count: 1, halfBroken: Math.random() < 0.5, enchanted: Math.random() < (0.05 * (tier + 1)) };
  }
  let choice;
  if (tier >= 5 && Math.random() < 0.25) choice = pickFromArray(TRANSCENDENT_POOL);
  else if (tier >= 3 && Math.random() < 0.25) choice = pickFromArray(EPIC_POOL);
  else choice = pickFromArray(pool);
  const halfBroken = (Math.random() < 0.25 && /sword|pickaxe|axe|helmet|chestplate|leggings|boots/.test(choice));
  const enchanted = Math.random() < (0.02 * (tier + 1));
  return { id: choice, count: 1, halfBroken, enchanted };
}

const damageMap = new Map();
function damageMapGet(id) { return damageMap.get(id) ?? 0; }
function damageMapAdd(id, amount) { damageMap.set(id, damageMapGet(id) + amount); }
function damageMapDelete(id) { damageMap.delete(id); }

system.beforeEvents.startup.subscribe(ev => {
  ev.itemComponentRegistry.registerCustomComponent("cloud_loot_bags:on_use", {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      if (!player || !item) return;
      const bagId = item.typeId;
      const tier = getTierFromBagId(bagId);
      let useRandom = false;
      try { useRandom = bagId.includes("random") || item.hasTag?.("random_loot") || false; } catch {}
      const dim = player.dimension;
      const loc = player.location;
      if (useRandom) {
        const result = generateRandomForTier(tier);
        if (!result) return;
        const stack = createItemStackWithDamage(result.id, result.count, result.halfBroken);
        if (stack && result.enchanted) tryEnchantStackBestEffort(stack, tier);
        try { if (stack) dim.spawnItem(stack, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }); }
        catch { trySpawnFallback(dim, result.id, result.count, loc); }
      } else {
        const bag = generateLootBagFromList(tier);
        if (bag) {
          try { dim.spawnItem(bag, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }); }
          catch {}
        } else {
          const result = generateRandomForTier(tier);
          if (result) {
            const stack = createItemStackWithDamage(result.id, result.count, result.halfBroken);
            if (stack && result.enchanted) tryEnchantStackBestEffort(stack, tier);
            try { if (stack) dim.spawnItem(stack, { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }); }
            catch { trySpawnFallback(dim, result.id, result.count, loc); }
          }
        }
      }
      if (player.getGameMode() !== GameMode.Creative) {
        const equip = player.getComponent(EntityComponentTypes.Equippable);
        const hand = equip?.getEquipmentSlot(EquipmentSlot.Mainhand);
        if (!equip || !hand) return;
        if (item.amount <= 1) equip.setEquipment(EquipmentSlot.Mainhand, undefined);
        else {
          item.amount--;
          equip.setEquipment(EquipmentSlot.Mainhand, item);
        }
      }
    }
  });
});

function trySpawnFallback(dim, id, count, loc) {
  try { dim.spawnItem(new ItemStack(id, count), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }); return true; }
  catch { try { dim.spawnItem(new ItemStack("minecraft:stone", 1), { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }); return true; } catch { return false; } }
}

world.afterEvents.entityHurt.subscribe(({ damage, damageSource, hurtEntity }) => {
  const attacker = damageSource?.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  if (!hurtEntity) return;
  const tf = hurtEntity.getComponent("type_family");
  if (!tf?.getTypeFamilies()?.includes("monster")) return;
  if (damage > 0) damageMapAdd(hurtEntity.id, damage);
});

const ranges = [14,20,25,35,50,83,108,150,230,400,600,1000,10000];

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (!deadEntity) return;
  if (!damageMap.has(deadEntity.id)) return;

  const maxHealth = deadEntity.getComponent(EntityComponentTypes.Health)?.effectiveMax;
  if (!maxHealth) return damageMapDelete(deadEntity.id)

  const totalDamage = damageMapGet(deadEntity.id);
  if (totalDamage < maxHealth * 0.25) return damageMapDelete(deadEntity.id);

  const index = ranges.findIndex(v => maxHealth <= v);
  const tier = index === -1 ? null : index + 1;
  damageMapDelete(deadEntity.id);
  if (!tier) return

  const lootBag = generateLootBagFromList(tier);
  if (!lootBag) return;

  deadEntity.dimension.spawnItem(lootBag, deadEntity.location);
});

world.afterEvents.entityRemove.subscribe(e => { damageMapDelete(e.removedEntityId); });