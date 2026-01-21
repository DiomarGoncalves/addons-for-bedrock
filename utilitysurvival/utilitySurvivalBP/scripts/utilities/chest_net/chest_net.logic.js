import { system, world } from "@minecraft/server";
import { CONTAINER_BLOCK_IDS } from "../../config/constants";
import {
  ensureRegistry,
  parseKey,
  getInputsByNet,
  getOutputsByNet,
} from "./chest_net.registry";

// =====================================================
// Chest Network item transfer (Entrada -> Saída)
//
// - Sem entidades por baú/link (só 1 registry)
// - Só funciona em chunks carregados
// - Agora move o baú inteiro (por run), com limite anti-lag
// =====================================================

const TICK_INTERVAL = 5;              // mais rápido que 10
const MAX_STACKS_MOVED_PER_RUN = 128; // teto global (anti-lag)

function getDimensionById(dimId) {
  const id = String(dimId);
  if (id.endsWith("overworld")) return world.getDimension("overworld");
  if (id.endsWith("nether")) return world.getDimension("nether");
  if (id.endsWith("the_end") || id.endsWith("end")) return world.getDimension("the_end");
  try { return world.getDimension(id); } catch { return null; }
}

function getBlockAtKey(key) {
  const parsed = parseKey(key);
  if (!parsed) return null;
  const dim = getDimensionById(parsed.dimId);
  if (!dim) return null;
  try {
    return dim.getBlock({ x: parsed.x, y: parsed.y, z: parsed.z });
  } catch {
    return null;
  }
}

function getContainerFromBlock(block) {
  try {
    const c1 = block.getComponent("inventory")?.container;
    if (c1) return c1;
  } catch {}
  try {
    const c2 = block.getComponent("minecraft:inventory")?.container;
    if (c2) return c2;
  } catch {}
  return null;
}

function isContainerBlock(block) {
  if (!block) return false;
  try {
    const c1 = block.getComponent("inventory")?.container;
    if (c1) return true;
  } catch {}
  try {
    const c2 = block.getComponent("minecraft:inventory")?.container;
    if (c2) return true;
  } catch {}
  try {
    return CONTAINER_BLOCK_IDS.includes(block.typeId);
  } catch {
    return false;
  }
}

function tryMoveStackFromSlot(inputContainer, slotIndex, outputContainer) {
  const item = inputContainer.getItem(slotIndex);
  if (!item) return false;

  let moving;
  try { moving = item.clone(); }
  catch { moving = item; }

  let leftover = null;
  try { leftover = outputContainer.addItem(moving); }
  catch { return false; }

  // Tudo inserido
  if (!leftover) {
    try { inputContainer.setItem(slotIndex, undefined); }
    catch { try { inputContainer.setItem(slotIndex, null); } catch {} }
    return true;
  }

  // Inserção parcial
  const leftAmount = Number(leftover.amount ?? 0);
  const original = Number(item.amount ?? 0);
  const movedAmount = original - leftAmount;

  if (movedAmount <= 0) return false;

  try {
    const newItem = item;
    newItem.amount = leftAmount;
    if (leftAmount <= 0) inputContainer.setItem(slotIndex, undefined);
    else inputContainer.setItem(slotIndex, newItem);
  } catch {}

  return true;
}

function moveAllPossible(inputContainer, outputContainers, movesRef) {
  // tenta mover slot por slot, escolhendo a primeira saída que aceitar
  const size = inputContainer.size;

  for (let i = 0; i < size; i++) {
    if (movesRef.count >= MAX_STACKS_MOVED_PER_RUN) return;

    const item = inputContainer.getItem(i);
    if (!item) continue;

    for (const oc of outputContainers) {
      const did = tryMoveStackFromSlot(inputContainer, i, oc);
      if (did) {
        movesRef.count++;
        break; // passa pro próximo slot
      }
    }
  }
}

function runOnce() {
  const registry = ensureRegistry();

  const inputsByNet = getInputsByNet(registry);
  const outputsByNet = getOutputsByNet(registry);

  const movesRef = { count: 0 };

  for (const [netId, inputKeys] of inputsByNet.entries()) {
    const outputKeys = outputsByNet.get(netId);
    if (!outputKeys || outputKeys.length === 0) continue;

    // resolve saídas carregadas
    const outputContainers = [];
    for (const ok of outputKeys) {
      const ob = getBlockAtKey(ok);
      if (!isContainerBlock(ob)) continue;
      const oc = getContainerFromBlock(ob);
      if (!oc) continue;
      outputContainers.push(oc);
    }
    if (outputContainers.length === 0) continue;

    // agora move "o baú todo" (até limite global)
    for (const ik of inputKeys) {
      if (movesRef.count >= MAX_STACKS_MOVED_PER_RUN) return;

      const ib = getBlockAtKey(ik);
      if (!isContainerBlock(ib)) continue;

      const ic = getContainerFromBlock(ib);
      if (!ic) continue;

      moveAllPossible(ic, outputContainers, movesRef);
    }
  }
}

system.runInterval(() => {
  try { runOnce(); } catch {}
}, TICK_INTERVAL);
