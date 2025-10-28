// SimpleWirelessStorage - server.js
// Requer: Minecraft Bedrock 1.21+ / Script API v1.10+
// Responsável por regras de jogo, conexão de baús, transferência de itens e abertura de UIs.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

/* =========================
   Configurações e Constantes
========================= */

const REMOTE_ID = "wireless:remote_control";
const THEME = "§8"; // paleta A8 (cinza) em todos os textos
const MAX_PER_REMOTE = 10;

const VALID_CONTAINERS = [
  "minecraft:chest",
  "minecraft:barrel",
  "minecraft:trapped_chest",
  "minecraft:shulker_box",
  "minecraft:hopper",
  "minecraft:dispenser",
  "minecraft:dropper",
  "minecraft:ender_chest",
  "minecraft:copper_chest",
  "minecraft:exposed_copper_chest",
  "minecraft:oxidized_copper_chest",
  "minecraft:weathered_copper_chest",
  "minecraft:waxed_copper_chest",
  "minecraft:waxed_exposed_copper_chest",
  "minecraft:waxed_oxidized_copper_chest",
  "minecraft:waxed_weathered_copper_chest",
];

const DISPLAY_NAMES = {
  "minecraft:chest": "Baú",
  "minecraft:barrel": "Barril",
  "minecraft:trapped_chest": "Baú com Armadilha",
  "minecraft:shulker_box": "Shulker Box",
  "minecraft:hopper": "Funil",
  "minecraft:dispenser": "Dispensador",
  "minecraft:dropper": "Dropper",
  "minecraft:ender_chest": "Baú do Fim",
  "minecraft:copper_chest": "Baú de Cobre",
  "minecraft:exposed_copper_chest": "Baú de Cobre Exposto",
  "minecraft:oxidized_copper_chest": "Baú de Cobre Oxidado",
  "minecraft:weathered_copper_chest": "Baú de Cobre Envelhecido",
  "minecraft:waxed_copper_chest": "Baú de Cobre Encerado",
  "minecraft:waxed_exposed_copper_chest": "Baú de Cobre Encerado Exposto",
  "minecraft:waxed_oxidized_copper_chest": "Baú de Cobre Encerado Oxidado",
  "minecraft:waxed_weathered_copper_chest": "Baú de Cobre Encerado Envelhecido",
};

/* =========================
   Utilitários: Remote por Item (Lore)
   Formato da lore:
   0: "§8Wireless Storage"
   1: "§8#WS v1"
   2..N: "§8• name|x|y|z|dimension|blockType"
========================= */

function ensureLore(remote) {
  const lore = remote.getLore() ?? [];
  if (!lore[0]?.includes("Wireless Storage")) {
    const base = [
      `${THEME}Wireless Storage`,
      `${THEME}#WS v1`,
      `${THEME}Nenhum container conectado.`,
      `${THEME}Agache + clique em um baú para conectar.`,
    ];
    remote.setLore(base);
  }
  return remote.getLore();
}

function parseRemoteData(remote) {
  const lore = ensureLore(remote);
  const out = [];
  for (const line of lore) {
    if (line?.startsWith(`${THEME}• `)) {
      // • name|x|y|z|dimension|blockType
      const raw = line.slice(`${THEME}• `.length);
      const [name, xs, ys, zs, dim, type] = raw.split("|");
      const x = Number(xs), y = Number(ys), z = Number(zs);
      out.push({ name, x, y, z, dimension: dim, blockType: type });
    }
  }
  return out;
}

function writeRemoteData(remote, list) {
  const header = [`${THEME}Wireless Storage`, `${THEME}#WS v1`];
  const body =
    list.length === 0
      ? [`${THEME}Nenhum container conectado.`, `${THEME}Agache + clique em um baú para conectar.`]
      : list.map((c, i) =>
          `${THEME}• ${c.name}|${c.x}|${c.y}|${c.z}|${c.dimension}|${c.blockType}`
        );

  // lista "legível" adicional
  const human = [];
  if (list.length > 0) {
    human.push(`${THEME}Conectados: ${list.length}/${MAX_PER_REMOTE}`);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const dn = DISPLAY_NAMES[c.blockType] ?? c.blockType.replace("minecraft:", "");
      human.push(`${THEME}${i + 1}. ${c.name} — ${dn} (${c.x}, ${c.y}, ${c.z})`);
    }
    human.push(`${THEME}Use o controle para acessar o menu.`);
  }

  remote.setLore([...header, ...body, ...(human.length ? ["", ...human] : [])]);
}

function getHandRemote(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return { container: null, slot: -1, item: null };

  const selected = player.selectedSlot ?? 0;
  const item = inv.getItem(selected);
  if (item?.typeId !== REMOTE_ID) return { container: inv, slot: selected, item: null };
  return { container: inv, slot: selected, item };
}

function updateHandRemote(player, item) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  const selected = player.selectedSlot ?? 0;
  inv.setItem(selected, item);
}

/* =========================
   Utils: Container e Transferência
========================= */

function getContainerFromConnection(conn) {
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

function listItems(container) {
  const arr = [];
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (it) arr.push({ slot: i, typeId: it.typeId, amount: it.amount, max: it.maxAmount });
  }
  return arr;
}

function transferItem(containerFrom, slotIndex, containerTo, qty) {
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

function transferAll(containerFrom, containerTo) {
  let total = 0;
  for (let i = 0; i < containerFrom.size; i++) {
    const item = containerFrom.getItem(i);
    if (!item) continue;
    const moved = transferItem(containerFrom, i, containerTo, item.amount);
    total += moved;
  }
  return total;
}


/* =========================
   UI: Fluxos
========================= */

async function uiConnectChest(player, block) {
  const { item: remote, container, slot } = getHandRemote(player);
  if (!remote) {
    player.sendMessage(`${THEME}[Storage] Segure o Remote Control para conectar.`);
    return;
  }

  const blockType = block.typeId;
  if (!VALID_CONTAINERS.includes(blockType)) {
    player.sendMessage(`${THEME}[Storage] Este bloco não é um container suportado.`);
    return;
  }

  const list = parseRemoteData(remote);
  if (list.length >= MAX_PER_REMOTE) {
    player.sendMessage(`${THEME}[Storage] Limite de ${MAX_PER_REMOTE} containers por controle.`);
    return;
  }

  const nameForm = new ModalFormData()
    .title(`${THEME} Conectar Container`)
    .textField(`${THEME}Nome do container:`, "Ex.: Armaduras", "");

  const res = await nameForm.show(player);
  if (res.canceled) return;

  const name = (res.formValues?.[0] ?? "").toString().trim();
  if (!name) {
    player.sendMessage(`${THEME}[Storage] Nome inválido.`);
    return;
  }

  const loc = block.location;
  const conn = {
    name,
    x: Math.floor(loc.x),
    y: Math.floor(loc.y),
    z: Math.floor(loc.z),
    dimension: block.dimension.id,
    blockType: block.typeId,
  };

  list.push(conn);
  writeRemoteData(remote, list);
  // grava de volta no slot da mão
  container.setItem(slot, remote);

  player.sendMessage(`${THEME}[Storage] "${name}" conectado!`);
}

async function uiOpenRemote(player) {
  const { item: remote } = getHandRemote(player);
  if (!remote) {
    player.sendMessage(`${THEME}[Storage] Segure o Remote Control para abrir o menu.`);
    return;
  }
  const list = parseRemoteData(remote);
  if (list.length === 0) {
    const mf = new MessageFormData()
      .title(`${THEME}Wireless Storage`)
      .body(
        `${THEME}Você não tem containers conectados neste controle.\n\n` +
        `${THEME}Dica: agache + clique em um baú para conectar.`
      )
      .button1(`${THEME}OK`);
    await mf.show(player);
    return;
  }

  const af = new ActionFormData()
    .title(`${THEME}Wireless Storage`)
    .body(`${THEME}Selecione um container\n${THEME}Total: ${list.length}/${MAX_PER_REMOTE}`);

  for (const c of list) {
    const dn = DISPLAY_NAMES[c.blockType] ?? c.blockType.replace("minecraft:", "");
    af.button(`${THEME}${c.name}\n${THEME}${dn} (${c.x}, ${c.y}, ${c.z})`);
  }

  const r = await af.show(player);
  if (r.canceled) return;

  const idx = r.selection;
  if (idx == null) return;

  const chosen = list[idx];
  await uiContainerActions(player, chosen);
}

async function uiContainerActions(player, conn) {
  const dn = DISPLAY_NAMES[conn.blockType] ?? conn.blockType.replace("minecraft:", "");

  const af = new ActionFormData()
    .title(`${THEME}${conn.name}`)
    .body(
      `${THEME}Tipo: ${dn}\n` +
      `${THEME}Posição: ${conn.x}, ${conn.y}, ${conn.z}\n` +
      `${THEME}Dimensão: ${conn.dimension}\n\n` +
      `${THEME}Selecione a ação:`
    )
    .button(`${THEME} Importar (Player  Container)`)
    .button(`${THEME} Exportar (Container  Player)`)
    .button(`${THEME}Voltar`);

  const r = await af.show(player);
  if (r.canceled) return;

  if (r.selection === 0) {
    await uiImport(player, conn);
    await uiContainerActions(player, conn);
  } else if (r.selection === 1) {
    await uiExport(player, conn);
    await uiContainerActions(player, conn);
  } else {
    await uiOpenRemote(player);
  }
}

async function uiImport(player, conn) {
  const chest = getContainerFromConnection(conn);
  if (!chest) {
    player.sendMessage(`${THEME}[Storage] Container inacessível.`);
    return;
  }

  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  while (true) {
    const items = listItems(inv);
    const af = new ActionFormData()
      .title(`${THEME}Importar (Player  ${conn.name})`)
      .body(`${THEME}Escolha um item do seu inventário:\n${THEME}Transferir Tudo = último botão`);
    for (const e of items) af.button(`${THEME}${e.typeId} x${e.amount}`);
    af.button(`${THEME}Transferir Todo o Inventário`);

    const r = await af.show(player);
    if (r.canceled) break;

    if (r.selection === items.length) {
      const movedStacks = transferAll(inv, chest);

      player.sendMessage(`${THEME}[Storage] ${movedStacks} stack(s) importados.`);
      break;
    }

    const chosen = items[r.selection];
    if (!chosen) continue;

    // Slider 1..64 (limitado pelo que o player tem e pelo máx do item)
    const maxQty = Math.min(64, chosen.amount);
    const mf = new ModalFormData()
      .title(`${THEME}Quantidade`)
      .slider(`${THEME}Selecione a quantidade:`, 1, maxQty, 1, Math.min(64, maxQty));

    const q = await mf.show(player);
    if (q.canceled) continue;

    const qty = Math.max(1, Math.min(maxQty, Number(q.formValues?.[0] ?? 1)));
    const moved = transferItem(inv, chosen.slot, chest, qty);

    if (moved > 0) {
      player.sendMessage(`${THEME}[Storage] Importado: ${chosen.typeId} x${moved}`);
    } else {
      player.sendMessage(`${THEME}[Storage] Sem espaço no container ou quantidade inválida.`);
    }
  }
}

async function uiExport(player, conn) {
  const chest = getContainerFromConnection(conn);
  if (!chest) {
    player.sendMessage(`${THEME}[Storage] Container inacessível.`);
    return;
  }

  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  while (true) {
    const items = listItems(chest);
    const af = new ActionFormData()
      .title(`${THEME}Exportar (${conn.name}  Player)`)
      .body(`${THEME}Escolha um item do container:\n${THEME}Transferir Tudo = último botão`);
    for (const e of items) af.button(`${THEME}${e.typeId} x${e.amount}`);
    af.button(`${THEME}Transferir Todo o Container`);

    const r = await af.show(player);
    if (r.canceled) break;

    if (r.selection === items.length) {
      const movedStacks = transferAll(chest, inv);

      player.sendMessage(`${THEME}[Storage] ${movedStacks} stack(s) exportados.`);
      break;
    }

    const chosen = items[r.selection];
    if (!chosen) continue;

    const maxQty = Math.min(64, chosen.amount);
    const mf = new ModalFormData()
      .title(`${THEME}Quantidade`)
      .slider(`${THEME}Selecione a quantidade:`, 1, maxQty, 1, Math.min(64, maxQty));

    const q = await mf.show(player);
    if (q.canceled) continue;

    const qty = Math.max(1, Math.min(maxQty, Number(q.formValues?.[0] ?? 1)));
    const moved = transferItem(chest, chosen.slot, inv, qty);

    if (moved > 0) {
      player.sendMessage(`${THEME}[Storage] Exportado: ${chosen.typeId} x${moved}`);
    } else {
      player.sendMessage(`${THEME}[Storage] Sem espaço no inventário ou quantidade inválida.`);
    }
  }
}

/* =========================
   Eventos
========================= */

// Sneak + clique em container com o Remote  conectar
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  try {
    const { player, block, itemStack } = ev;
    if (!player || !block) return;

    if (!VALID_CONTAINERS.includes(block.typeId)) return;
    if (itemStack?.typeId !== REMOTE_ID) return;

    if (player.isSneaking) {
      ev.cancel = true;
      system.run(() => uiConnectChest(player, block));
    }
  } catch {}
});

// Usar o remote em qualquer lugar (não sneakar)  abrir menu
world.afterEvents.itemUse.subscribe((ev) => {
  try {
    const { source: player, itemStack } = ev;
    if (itemStack?.typeId !== REMOTE_ID) return;
    if (player?.isSneaking) return; // prioridade para conectar ao sneakar

    system.run(() => uiOpenRemote(player));
  } catch {}
});

console.warn("[Wireless Storage] server.js carregado");
