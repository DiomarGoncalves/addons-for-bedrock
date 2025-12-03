// uiFlows.js
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { THEME, MAX_PER_REMOTE, VALID_CONTAINERS, DISPLAY_NAMES } from "./config.js";
import { getHandRemote, parseRemoteData, writeRemoteData } from "./remoteUtils.js";
import { getContainerFromConnection, listItems, transferItem, transferAll } from "./containerUtils.js";

/**
 * Mensagem padronizada para quando o item não é o Remote
 */
function needRemoteMsg(player, forAction = "abrir o menu") {
  try {
    player.sendMessage(`${THEME}[Storage] Segure o Remote Control para ${forAction}.`);
  } catch {}
}

/**
 * UI para conectar um container quando o player agacha e clica no bloco.
 * Protegido contra remotes nulos e containers inválidos.
 */
export async function uiConnectChest(player, block) {
  try {
    const { item: remote, container, slot } = getHandRemote(player);
    if (!remote) {
      needRemoteMsg(player, "conectar");
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
    if (!res || res.canceled) return;

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

    // grava de volta no slot da mão (se possível)
    try {
      if (container && slot >= 0) container.setItem(slot, remote);
    } catch (err) {
      console.warn("[Wireless Storage] warning ao setar item no inventário:", err);
    }

    player.sendMessage(`${THEME}[Storage] "${name}" conectado!`);
  } catch (err) {
    console.error("[Wireless Storage] uiConnectChest error:", err);
    try { player.sendMessage(`${THEME}[Storage] Erro ao conectar container.`); } catch {}
  }
}

/**
 * Abre o menu principal do remote.
 */
export async function uiOpenRemote(player) {
  try {
    const { item: remote } = getHandRemote(player);
    if (!remote) {
      needRemoteMsg(player, "abrir o menu");
      return;
    }

    const list = parseRemoteData(remote);
    if (!list || list.length === 0) {
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
    if (!r || r.canceled) return;

    const idx = r.selection;
    if (idx == null) return;

    const chosen = list[idx];
    if (!chosen) {
      player.sendMessage(`${THEME}[Storage] Escolha inválida.`);
      return;
    }

    await uiContainerActions(player, chosen, remote);
  } catch (err) {
    console.error("[Wireless Storage] uiOpenRemote error:", err);
    try { player.sendMessage(`${THEME}[Storage] Erro ao abrir o menu.`); } catch {}
  }
}

async function uiContainerActions(player, conn, remote) {
  try {
    // Validar container novamente aqui (pode ter sido removido)
    const dn = DISPLAY_NAMES[conn.blockType] ?? conn.blockType.replace("minecraft:", "");

    const af = new ActionFormData()
      .title(`${THEME}${conn.name}`)
      .body(
        `${THEME}Tipo: ${dn}\n` +
          `${THEME}Posição: ${conn.x}, ${conn.y}, ${conn.z}\n` +
          `${THEME}Dimensão: ${conn.dimension}\n\n` +
          `${THEME}Selecione a ação:`
      )
      .button(`${THEME} Importar (Player > Container)`)
      .button(`${THEME} Exportar (Container > Player)`)
      .button(`${THEME}Remover conexão`)
      .button(`${THEME}Voltar`);

    const r = await af.show(player);
    if (!r || r.canceled) return;

    if (r.selection === 0) {
      await uiImport(player, conn);
      // volta ao menu de ações com um pequeno delay para evitar race
      return system.run(() => uiContainerActions(player, conn, remote));
    } else if (r.selection === 1) {
      await uiExport(player, conn);
      return system.run(() => uiContainerActions(player, conn, remote));
    } else if (r.selection === 2) {
      // remover conexão da lore
      try {
        const { item: curRemote } = getHandRemote(player);
        if (!curRemote) {
          needRemoteMsg(player, "remover conexão");
          return;
        }
        const list = parseRemoteData(curRemote);
        const idx = list.findIndex(
          (x) => x.x === conn.x && x.y === conn.y && x.z === conn.z && x.dimension === conn.dimension
        );
        if (idx >= 0) {
          list.splice(idx, 1);
          writeRemoteData(curRemote, list);
          player.sendMessage(`${THEME}[Storage] Conexão removida.`);
        } else {
          player.sendMessage(`${THEME}[Storage] Conexão não encontrada na lore.`);
        }
      } catch (err) {
        console.error("[Wireless Storage] remover conexão error:", err);
        player.sendMessage(`${THEME}[Storage] Erro ao remover conexão.`);
      }
      return system.run(() => uiOpenRemote(player));
    } else {
      return system.run(() => uiOpenRemote(player));
    }
  } catch (err) {
    console.error("[Wireless Storage] uiContainerActions error:", err);
    try { player.sendMessage(`${THEME}[Storage] Erro ao processar ações do container.`); } catch {}
  }
}

/**
 * UI de importação (player -> container remoto).
 */
export async function uiImport(player, conn) {
  try {
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
        .title(`${THEME}Importar (Player → ${conn.name})`)
        .body(`${THEME}Escolha um item do seu inventário:\n${THEME}Transferir Tudo = último botão`);
      for (const e of items) af.button(`${THEME}${e.typeId} x${e.amount}`);
      af.button(`${THEME}Transferir Todo o Inventário`);

      const r = await af.show(player);
      if (!r || r.canceled) break;

      if (r.selection === items.length) {
        const movedStacks = transferAll(inv, chest);
        player.sendMessage(`${THEME}[Storage] ${movedStacks} stack(s) importados.`);
        break;
      }

      const chosen = items[r.selection];
      if (!chosen) continue;

      const maxQty = Math.min(64, chosen.amount);
      const mf = new ModalFormData()
        .title(`${THEME}Quantidade`)
        .slider(`${THEME}Selecione a quantidade:`, 1, maxQty, 1, Math.min(64, maxQty));

      const q = await mf.show(player);
      if (!q || q.canceled) continue;

      const qty = Math.max(1, Math.min(maxQty, Number(q.formValues?.[0] ?? 1)));
      const moved = transferItem(inv, chosen.slot, chest, qty);

      if (moved > 0) {
        player.sendMessage(`${THEME}[Storage] Importado: ${chosen.typeId} x${moved}`);
      } else {
        player.sendMessage(`${THEME}[Storage] Sem espaço no container ou quantidade inválida.`);
      }
    }
  } catch (err) {
    console.error("[Wireless Storage] uiImport error:", err);
    try { player.sendMessage(`${THEME}[Storage] Erro na importação.`); } catch {}
  }
}

/**
 * UI de exportação (container remoto -> player).
 */
export async function uiExport(player, conn) {
  try {
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
        .title(`${THEME}Exportar (${conn.name} → Player)`)
        .body(`${THEME}Escolha um item do container:\n${THEME}Transferir Tudo = último botão`);
      for (const e of items) af.button(`${THEME}${e.typeId} x${e.amount}`);
      af.button(`${THEME}Transferir Todo o Container`);

      const r = await af.show(player);
      if (!r || r.canceled) break;

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
      if (!q || q.canceled) continue;

      const qty = Math.max(1, Math.min(maxQty, Number(q.formValues?.[0] ?? 1)));
      const moved = transferItem(chest, chosen.slot, inv, qty);

      if (moved > 0) {
        player.sendMessage(`${THEME}[Storage] Exportado: ${chosen.typeId} x${moved}`);
      } else {
        player.sendMessage(`${THEME}[Storage] Sem espaço no inventário ou quantidade inválida.`);
      }
    }
  } catch (err) {
    console.error("[Wireless Storage] uiExport error:", err);
    try { player.sendMessage(`${THEME}[Storage] Erro na exportação.`); } catch {}
  }
}
