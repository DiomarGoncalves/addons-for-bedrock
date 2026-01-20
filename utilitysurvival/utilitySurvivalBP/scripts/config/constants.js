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
export const TAG_VACUUM = "eh_vacuum";
export const TAG_VACUUM_KEY_PREFIX = "ehk:";
export const TAG_RANGE_PREFIX = "ehr:";

export const EH_DEBUG = false   ; 

export const REGISTRY_ENTITY_ID = "minecraft:armor_stand";
export const TAG_REGISTRY = "eh_registry";
export const TAG_ACTIVE_PREFIX = "eha:"; // eha:dim|x|y|z|range