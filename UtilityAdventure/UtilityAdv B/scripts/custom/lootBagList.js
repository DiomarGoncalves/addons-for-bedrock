import { world } from "@minecraft/server"

export const lootBagList = [
  [ // Tier 1
    { id: "cloud_loot_bags:common_loot_bag", chance: 10 }
  ],
  [ // Tier 2
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 7.5 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 15, maxCount: 2 }
  ],
  [ // Tier 3
    { id: "cloud_loot_bags:rare_loot_bag", chance: 8 },
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 14 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 20, maxCount: 2 }
  ],
  [ // Tier 4
    { id: "cloud_loot_bags:epic_loot_bag", chance: 5 },
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 20 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 25, maxCount: 2 }
  ],
  [ // Tier 5
    { id: "cloud_loot_bags:legendary_loot_bag", chance: 1 },
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 30 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 35, maxCount: 2 }
  ],
  [ // Tier 6
    { id: "cloud_loot_bags:transcendent_loot_bag", chance: 0.1 },
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 40 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 45, maxCount: 2 }
  ],
  [ // Tier 7
    { id: "cloud_loot_bags:divine_loot_bag", chance: 0.1 },
    { id: "cloud_loot_bags:uncommon_loot_bag", chance: 50 },
    { id: "cloud_loot_bags:common_loot_bag", chance: 55, maxCount: 2 }
  ]
]