import { world } from "@minecraft/server";
import { DP_ENDER_HOPPER } from "../config/constants";

function keyFromBlock(block) {
  const dimId = block.dimension.id;
  const { x, y, z } = block.location;
  return `${dimId}|${x}|${y}|${z}`;
}

export function getKeyFromCoords(dimId, x, y, z) {
  return `${dimId}|${x}|${y}|${z}`;
}

let cachedMap = null;

function readMap() {
  if (cachedMap) return cachedMap;
  const raw = world.getDynamicProperty(DP_ENDER_HOPPER);
  if (!raw) {
    cachedMap = {};
    return cachedMap;
  }
  try {
    const obj = JSON.parse(raw);
    cachedMap = obj && typeof obj === "object" ? obj : {};
  } catch {
    cachedMap = {};
  }
  return cachedMap;
}

function writeMap(map) {
  cachedMap = map;
  world.setDynamicProperty(DP_ENDER_HOPPER, JSON.stringify(map));
}

export function getAllConfigs() {
  return readMap();
}

export function getHopperConfig(block) {
  const key = keyFromBlock(block);
  const map = readMap();
  const cfg = map[key];
  if (!cfg) return { enabled: false, range: 0 };

  return {
    enabled: !!cfg.enabled,
    range: Number.isFinite(cfg.range) ? cfg.range : 0,
  };
}

export function saveHopperConfig(block, config) {
  const key = keyFromBlock(block);
  const map = readMap();

  map[key] = {
    enabled: !!config.enabled,
    range: Number.isFinite(config.range) ? config.range : 0,
  };

  writeMap(map);
}

export function disableHopperByKey(key) {
  const map = readMap();
  if (!map[key]) return;

  map[key].enabled = false;
  map[key].range = map[key].range ?? 0;

  writeMap(map);
}

export function getConfigByKey(key) {
  const map = readMap();
  const cfg = map[key];
  if (!cfg) return { enabled: false, range: 0 };
  return {
    enabled: !!cfg.enabled,
    range: Number.isFinite(cfg.range) ? cfg.range : 0,
  };
}
