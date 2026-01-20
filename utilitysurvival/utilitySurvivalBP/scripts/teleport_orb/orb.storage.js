import { DP_SAVED_WARPS } from "../config/constants";

export function getPlayerWarps(player) {
  const data = player.getDynamicProperty(DP_SAVED_WARPS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function savePlayerWarps(player, warps) {
  player.setDynamicProperty(DP_SAVED_WARPS, JSON.stringify(warps));
}

export function getDimensionName(dimId) {
  return dimId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();
}
