// =====================
// IDs / ITENS / BLOCOS
// =====================

// Teleport Orb (seu sistema antigo)
export const ORB_ID = "custom:teleport_orb";

// Elevator (seu bloco de elevador)
export const ELEVATOR_ID = "custom:elevator";
export const ELEVATOR_MAX_DIST = 1000;

// Utilities
export const WRENCH_ID = "custom:wrench";

// Vanilla
export const HOPPER_ID = "minecraft:hopper";

// Containers (compatibilidade com mundos que usam baús diferentes / barrels / etc.)
// A lógica também tenta detectar container via component "inventory".
export const CONTAINER_BLOCK_IDS = [
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel",
  "minecraft:ender_chest",
  "minecraft:shulker_box",
  "minecraft:white_shulker_box",
  "minecraft:orange_shulker_box",
  "minecraft:magenta_shulker_box",
  "minecraft:light_blue_shulker_box",
  "minecraft:yellow_shulker_box",
  "minecraft:lime_shulker_box",
  "minecraft:pink_shulker_box",
  "minecraft:gray_shulker_box",
  "minecraft:light_gray_shulker_box",
  "minecraft:cyan_shulker_box",
  "minecraft:purple_shulker_box",
  "minecraft:blue_shulker_box",
  "minecraft:brown_shulker_box",
  "minecraft:green_shulker_box",
  "minecraft:red_shulker_box",
  "minecraft:black_shulker_box",
];

// =====================
// DYNAMIC PROPERTIES
// =====================

// Player DP (usado pelo Teleport Orb / warps)
export const DP_SAVED_WARPS = "saved_warps_json";

// World DP (usado pelo Ender Hopper)
export const DP_ENDER_HOPPER = "ender_hopper_map";

// (se você não estiver usando index, pode ignorar, mas não faz mal deixar)
// export const DP_ENDER_HOPPER_INDEX = "ender_hopper_index";

// =====================
// VACUUM ENTITY (ENDER HOPPER)
export const ENDER_HOPPER_MAX_RANGE = 15;

export const VACUUM_ENTITY_ID = "minecraft:armor_stand";
// Tags antigos (para manter mundos já configurados funcionando)
export const TAG_VACUUM_OLD = "eh_vacuum";
export const TAG_VACUUM_KEY_PREFIX_OLD = "ehk:";
export const TAG_RANGE_PREFIX_OLD = "ehr:";

// Tags novos (namespaced para evitar conflito com outros addons)
export const TAG_VACUUM = "us_eh_vacuum";
export const TAG_VACUUM_KEY_PREFIX = "us_ehk:";
export const TAG_RANGE_PREFIX = "us_ehr:";

export const EH_DEBUG = true   ; 

export const REGISTRY_ENTITY_ID = "minecraft:armor_stand";

export const TAG_REGISTRY_OLD = "eh_registry";
export const TAG_ACTIVE_PREFIX_OLD = "eha:"; // eha:dim|x|y|z|range

export const TAG_REGISTRY = "us_eh_registry";
export const TAG_ACTIVE_PREFIX = "us_eha:"; // us_eha:dim|x|y|z|range

// =====================
// CHEST NETWORK (ENDER-CHEST STYLE)
// =====================

// Stored as tags on the same registry entity (TAG_REGISTRY)
// Def:   cn_def:<netId>|<displayName>|<colorId>
// Input: cn_in:<dim|x|y|z>|<netId>
// Output subscription (many): cn_out:<dim|x|y|z>|<netId>
export const CN_DEF_PREFIX_OLD = "cn_def:";
export const CN_IN_PREFIX_OLD = "cn_in:";
export const CN_OUT_PREFIX_OLD = "cn_out:";

// Prefixes novos (namespaced)
export const CN_DEF_PREFIX = "us_cn_def:";
export const CN_IN_PREFIX = "us_cn_in:";
export const CN_OUT_PREFIX = "us_cn_out:";

// Color palette for links (id -> label)
export const CN_COLORS = [
  { id: "red", label: "Vermelho" },
  { id: "green", label: "Verde" },
  { id: "blue", label: "Azul" },
  { id: "yellow", label: "Amarelo" },
  { id: "purple", label: "Roxo" },
  { id: "white", label: "Branco" },
];