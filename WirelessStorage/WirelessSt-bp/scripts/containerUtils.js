// Funções utilitárias para containers e transferência de itens

import { world, ItemStack } from "@minecraft/server";

/**
 * Obtém o container (inventory) a partir de uma conexão salva.
 */
export function getContainerFromConnection(conn) {
  try {
    const dim = world.getDimension(conn.dimension);
    const block = dim.getBlock({ x: conn.x, y: conn.y, z: conn.z });
    if (!block || block.typeId !== conn.blockType) return null;
    const comp = block.getComponent("minecraft:inventory");
    return comp?.container ?? null;
  } catch {
    return null;
  }
}

/**
 * Lista itens de um container (slot, tipo, quantidade, máximo).
 */
export function listItems(container) {
  const arr = [];
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (it) arr.push({ slot: i, typeId: it.typeId, amount: it.amount, max: it.maxAmount });
  }
  return arr;
}

/**
 * Transfere quantidade (qty) de um slot de containerFrom para containerTo.
 * Retorna quantos itens de fato foram movidos.
 */
export function transferItem(containerFrom, slotIndex, containerTo, qty) {
  const src = containerFrom.getItem(slotIndex);
  if (!src || src.amount <= 0) return 0;

  const moveCount = Math.min(src.amount, Math.max(1, qty));
  const typeId = src.typeId;

  // Cria uma cópia apenas para o destino, com o mesmo stack size
  const transferStack = new ItemStack(typeId, moveCount);
  transferStack.nameTag = src.nameTag;
  transferStack.keepOnDeath = src.keepOnDeath;
  transferStack.lockMode = src.lockMode;
  transferStack.setLore(src.getLore());

  // ❌ NÃO usar get/setDynamicProperties (não existe em ItemStack)
  // transferStack.setDynamicProperties(src.getDynamicProperties());

  // Remove direto da origem
  if (src.amount === moveCount) {
    containerFrom.setItem(slotIndex, undefined);
  } else {
    src.amount -= moveCount;
    containerFrom.setItem(slotIndex, src);
  }

  // Agora insere no destino, respeitando empilhamento natural
  let remaining = moveCount;
  for (let i = 0; i < containerTo.size && remaining > 0; i++) {
    const slotItem = containerTo.getItem(i);
    if (!slotItem) {
      containerTo.setItem(i, new ItemStack(typeId, remaining));
      return moveCount;
    } else if (slotItem.typeId === typeId && slotItem.amount < slotItem.maxAmount) {
      const space = slotItem.maxAmount - slotItem.amount;
      const add = Math.min(space, remaining);
      slotItem.amount += add;
      containerTo.setItem(i, slotItem);
      remaining -= add;
    }
  }

  // Se sobrou (destino cheio), devolve o que não coube
  if (remaining > 0) {
    const returnItem = new ItemStack(typeId, remaining);
    containerFrom.addItem(returnItem);
  }

  return moveCount - remaining;
}

/**
 * Transfere todos os itens de containerFrom para containerTo.
 * Retorna o total de itens movidos.
 */
export function transferAll(containerFrom, containerTo) {
  let total = 0;
  for (let i = 0; i < containerFrom.size; i++) {
    const item = containerFrom.getItem(i);
    if (!item) continue;
    const moved = transferItem(containerFrom, i, containerTo, item.amount);
    total += moved;
  }
  return total;
}
