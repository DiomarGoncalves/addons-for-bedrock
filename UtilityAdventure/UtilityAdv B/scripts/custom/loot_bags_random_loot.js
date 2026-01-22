import { system } from "@minecraft/server";

export const LootPools = {
  common: new Set(),
  uncommon: new Set(),
  rare: new Set(),
  epic: new Set(),
  legendary: new Set(),
  divine: new Set(),
  transcendent: new Set()
};

const VALID_TIERS = new Set([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "divine",
  "transcendent"
]);

system.afterEvents.scriptEventReceive.subscribe(ev => {
  if (ev.id !== "random_loot:add") return;

  const tierRaw = ev.message?.tier;
  const item = ev.message?.item;

  if (typeof tierRaw !== "string") return;
  const tier = tierRaw.toLowerCase();
  if (!VALID_TIERS.has(tier)) return;
  if (typeof item !== "string") return;

  LootPools[tier].add(item);
});