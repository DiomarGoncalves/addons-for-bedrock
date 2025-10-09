import { world, system, GameMode, ItemStack } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { PermissionManager } from './permissions.js';
import { PlayerManager } from './playerManager.js';
import { InventoryManager } from './inventoryManager.js';
import { BanManager } from './banManager.js';

const permissionManager = new PermissionManager();
const playerManager = new PlayerManager();
const inventoryManager = new InventoryManager();
const banManager = new BanManager();

/** ===== DEBUG TOGGLE ===== */
let DEBUG = false;
/** Loga apenas se DEBUG = true */
function dbg(player, msg) {
  try {
    if (DEBUG && player && typeof player.sendMessage === 'function') {
      player.sendMessage(`§8[debug] ${msg}`);
    }
  } catch {}
}

/** Abre o painel quando usar o item do painel (ajuste o id se necessário) */
world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;
  if (!player || !itemStack) return;
  if (itemStack.typeId === 'admin:panel') {
    system.run(() => showMainMenu(player));
  }
});

/** =========================
 *  MENU PRINCIPAL
 *  ========================= */
async function showMainMenu(player) {
  const permission = permissionManager.getPermissionLevel(player);
  if (permission === 'none') {
    player.sendMessage('§8você não tem permissão para usar este painel.');
    return;
  }

  const isdono = permission === 'dono';

  const form = new ActionFormData()
    .title('§8painel administrativo')
    .body(`§8nível: ${isdono ? 'dono' : 'staff'}`)
    .button('§8gerenciar jogadores', 'textures/ui/icon_steve')
    .button('§8inventário de jogadores', 'textures/ui/storageIconColor');

  if (isdono) {
    form.button('§8desbanir jogadores', 'textures/ui/icon_lock');
  }

  form
    .button('§8meu modo de jogo', 'textures/ui/icon_setting')
    .button('§8modo invisível', 'textures/ui/invisibility_effect');

  if (isdono) {
    form.button(`§8debug: ${DEBUG ? 'on' : 'off'}`, 'textures/ui/icon_setting');
  }
  form.button('§8teleportar player', 'textures/ui/icon_steve');
  form.button('§8fechar', 'textures/ui/cancel');

  const resp = await form.show(player);
  if (resp.canceled) return;

  if (isdono) {
    // 0 gerenciar | 1 inv players | 2 unban | 3 gamemode | 4 invis | 5 debug | 6 tp | 7 fechar
    switch (resp.selection) {
      case 0: await showPlayerManagement(player); break;
      case 1: await showInventoryMenu(player); break;
      case 2: await showUnbanMenu(player); break;
      case 3: await showGameModeMenu(player); break;
      case 4: await toggleInvisibility(player); break;
      case 5:
        DEBUG = !DEBUG;
        player.sendMessage(`§8debug ${DEBUG ? 'ativado' : 'desativado'}`);
        await showMainMenu(player);
        break;
      case 6: await showTeleportMenu(player); break;
      default: break;
    }
  } else {
    // 0 gerenciar | 1 inv players | 2 gamemode | 3 invis | 4 tp | 5 fechar
    switch (resp.selection) {
      case 0: await showPlayerManagement(player); break;
      case 1: await showInventoryMenu(player); break;
      case 2: await showGameModeMenu(player); break;
      case 3: await toggleInvisibility(player); break;
      case 4: await showTeleportMenu(player); break;
      default: break;
    }
  }
}

/** Atalho para abrir inventário do próprio jogador */
async function showInventoryMenu(player) {
  dbg(player, 'abrindo inventário do próprio jogador');
  await showPlayerInventory(player, player);
}

/** =========================
 *  GERENCIAR JOGADORES
 *  ========================= */
async function showPlayerManagement(admin) {
  const permission = permissionManager.getPermissionLevel(admin);
  const isdono = permission === 'dono';

  const form = new ActionFormData()
    .title('§8gerenciar jogadores')
    .body('§8escolha uma opção:')
    .button('§8listar jogadores online', 'textures/ui/icon_steve')
    // .button('§8kickar jogador', 'textures/ui/cancel') // REMOVIDO
    .button('§8banir jogador', 'textures/ui/icon_lock')
    .button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === 2) { await showMainMenu(admin); return; }

  switch (r.selection) {
    case 0: await showPlayerList(admin); break;
    // case 1: await kickPlayer(admin); break; // REMOVIDO
    case 1:
      if (!isdono) {
        admin.sendMessage('§8apenas o dono pode banir jogadores.');
        await showPlayerManagement(admin);
      } else {
        await banPlayer(admin);
      }
      break;
  }
}

/** Lista e seleciona jogador alvo */
async function showPlayerList(admin) {
  const list = playerManager.getOnlinePlayers();
  dbg(admin, `listando jogadores online (${list.length})`);
  const form = new ActionFormData()
    .title('§8jogadores online')
    .body(`§8total: ${list.length}`);

  list.forEach(p => {
    const name = p?.name ?? p?.player?.name ?? 'desconhecido';
    form.button(name, 'textures/ui/icon_steve');
  });

  form.button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === list.length) { await showPlayerManagement(admin); return; }

  const picked = list[r.selection];
  const target = picked?.player ?? picked;
  if (!target || !target.name) {
    admin.sendMessage('§8[debug] alvo inválido.');
    return;
  }
  dbg(admin, `selecionado: ${target.name}`);
  await showPlayerActions(admin, target);
}

/** Ações sobre o jogador alvo */
async function showPlayerActions(admin, targetPlayer) {
  const permission = permissionManager.getPermissionLevel(admin);
  const isdono = permission === 'dono';

  const form = new ActionFormData()
    .title(`§8gerenciar: ${targetPlayer.name}`)
    .body('§8escolha uma ação:')
    .button('§8ver inventário', 'textures/ui/invisibility_effect');
    // .button('§8kickar', 'textures/ui/cancel'); // REMOVIDO

  if (isdono) {
    form.button('§8dar item', 'textures/ui/upload_glyph');
    form.button('§8limpar inventário', 'textures/ui/trash_default');
    form.button('§8banir', 'textures/ui/icon_lock');
  }

  form.button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;

  if (!isdono) {
    if (r.selection === 1) { await showPlayerList(admin); return; }
    switch (r.selection) {
      case 0: await showPlayerInventory(admin, targetPlayer); break;
      // case 1: playerManager.kickPlayer(targetPlayer, admin); break; // REMOVIDO
    }
    return;
  }

  if (r.selection === 4) { await showPlayerList(admin); return; }
  switch (r.selection) {
    case 0: await showPlayerInventory(admin, targetPlayer); break;
    // case 1: playerManager.kickPlayer(targetPlayer, admin); break; // REMOVIDO
    case 1: await giveItemToPlayer(admin, targetPlayer); break;
    case 2:
      try {
        (admin.runCommandAsync || admin.runCommand).call(admin, `clear "${targetPlayer.name}"`);
        admin.sendMessage(`§8inventário de ${targetPlayer.name} limpo.`);
      } catch { admin.sendMessage('§8erro ao limpar inventário.'); }
      await showPlayerActions(admin, targetPlayer);
      break;
    case 3: await banPlayer(admin, targetPlayer); break;
  }
}

/** =========================
 *  INVENTÁRIO DO JOGADOR
 *  ========================= */
async function showPlayerInventory(admin, targetPlayer) {
  const items = inventoryManager.getPlayerInventory(targetPlayer) || [];
  dbg(admin, `inventário de ${targetPlayer.name}: ${items.length} itens`);
  let body = '§8inventário:\n\n';
  if (items.length === 0) body += '§8inventário vazio.';
  else items.forEach((it, i) => { body += `§8[${i}] ${it.name} x${it.amount}\n`; });

  const form = new ActionFormData()
    .title(`§8inventário de ${targetPlayer.name}`)
    .body(body)
    .button('§8remover item', 'textures/ui/trash_default')
    .button('§8limpar inventário', 'textures/ui/trash_default')
    .button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === 2) { await showPlayerActions(admin, targetPlayer); return; }

  if (r.selection === 0) {
    await removeItemFromPlayer(admin, targetPlayer, items);
    return;
  }

  if (r.selection === 1) {
    const permission = permissionManager.getPermissionLevel(admin);
    if (permission !== 'dono') {
      admin.sendMessage('§8apenas o dono pode limpar inventário.');
      await showPlayerInventory(admin, targetPlayer);
      return;
    }
    try {
      (admin.runCommandAsync || admin.runCommand).call(admin, `clear "${targetPlayer.name}"`);
      admin.sendMessage(`§8inventário de ${targetPlayer.name} limpo.`);
    } catch { admin.sendMessage('§8erro ao limpar inventário.'); }
    await showPlayerInventory(admin, targetPlayer);
  }
}

/** Remover item (por slot) */
async function removeItemFromPlayer(admin, targetPlayer, snapshot) {
  if (!snapshot || snapshot.length === 0) {
    admin.sendMessage('§8inventário vazio.');
    return;
  }

  const form = new ActionFormData()
    .title(`§8remover item de ${targetPlayer.name}`)
    .body('§8selecione o item para remover:');

  snapshot.forEach(it => {
    form.button(`${it.name} x${it.amount} (slot ${it.slot})`, 'textures/ui/trash_default');
  });

  form.button('§8cancelar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === snapshot.length) { await showPlayerInventory(admin, targetPlayer); return; }

  const chosen = snapshot[r.selection];
  const ok = inventoryManager.removeItem(targetPlayer, chosen.slot);
  dbg(admin, `remover slot=${chosen.slot} ok=${ok}`);
  admin.sendMessage(ok ? `§8item removido do inventário de ${targetPlayer.name}.` : '§8falha ao remover item.');
  await showPlayerInventory(admin, targetPlayer);
}

/** =========================
 *  DAR ITEM (lista + personalizado)
 *  ========================= */
async function giveItemToPlayer(admin, targetPlayer) {
  const permission = permissionManager.getPermissionLevel(admin);
  if (permission !== 'dono') {
    admin.sendMessage('§8apenas o dono pode dar itens.');
    return;
  }

  const basicItems = [
    "stone","cobblestone","dirt","grass_block","sand","gravel","glass","oak_log","birch_log","spruce_log","acacia_log",
    "oak_planks","stick","torch","crafting_table","furnace","chest","ladder","iron_ingot","gold_ingot","diamond","emerald",
    "coal","redstone","lapis_lazuli","iron_sword","diamond_sword","bow","arrow","shield","iron_pickaxe","diamond_pickaxe",
    "iron_shovel","diamond_shovel","iron_axe","diamond_axe","apple","bread","cooked_beef","cooked_chicken","golden_apple",
    "bucket","water_bucket","lava_bucket","flint_and_steel","fishing_rod","compass","clock"
  ];

  const form = new ActionFormData()
    .title(`§8dar item para ${targetPlayer.name}`)
    .body('§8selecione um item ou personalize:')
    .button('§8item personalizado');

  basicItems.forEach(i => form.button(`§8${i}`));

  const r = await form.show(admin);
  if (r.canceled) return;

  if (r.selection === 0) {
    const modal = new ModalFormData()
      .title(`§8item personalizado para ${targetPlayer.name}`)
      .textField('§8id do item:', 'ex: diamond', '')
      .slider('§8quantidade:', 1, 64, 1, 1);

    const m = await modal.show(admin);
    if (m.canceled) return;

    const id = String(m.formValues[0] ?? '').trim();
    const amount = Number(m.formValues[1] ?? 1);
    const finalId = id.startsWith('minecraft:') ? id : `minecraft:${id}`;

    let ok = false;
    try {
      ok = inventoryManager.giveItem(targetPlayer, finalId, amount);
      dbg(admin, `give via container id=${finalId} q=${amount} ok=${ok}`);
    } catch {}
    if (!ok) {
      try {
        (admin.runCommandAsync || admin.runCommand).call(admin, `give "${targetPlayer.name}" ${finalId} ${amount}`);
        ok = true;
        dbg(admin, `give via comando id=${finalId} q=${amount}`);
      } catch { ok = false; }
    }
    admin.sendMessage(ok ? `§8${amount}x ${finalId} dado para ${targetPlayer.name}.` : '§8erro ao dar item.');
    return;
  }

  const chosen = basicItems[r.selection - 1];
  const finalId = `minecraft:${chosen}`;
  let ok = false;
  try {
    ok = inventoryManager.giveItem(targetPlayer, finalId, 1);
    dbg(admin, `give via container id=${finalId} q=1 ok=${ok}`);
  } catch {}
  if (!ok) {
    try {
      (admin.runCommandAsync || admin.runCommand).call(admin, `give "${targetPlayer.name}" ${finalId} 1`);
      ok = true;
      dbg(admin, `give via comando id=${finalId} q=1`);
    } catch { ok = false; }
  }
  admin.sendMessage(ok ? `§81x ${finalId} dado para ${targetPlayer.name}.` : '§8erro ao dar item.');
}

/** =========================
 *  DESBANIR / BANIR / GM / INVIS
 *  ========================= */
async function showUnbanMenu(admin) {
  const banned = banManager.getBannedPlayers();

  const form = new ActionFormData()
    .title('§8desbanir jogadores')
    .body(`§8banidos: ${banned.length}\n§8escolha uma opção:`)
    .button('§8digitar nome para desbanir', 'textures/ui/icon_setting');

  banned.forEach(b => {
    form.button(b.name, 'textures/ui/icon_lock');
  });

  form.button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(admin);
  if (r.canceled) return;

  if (r.selection === 0) {
    const modal = new ModalFormData()
      .title('§8desbanir por nome')
      .textField('§8nome do jogador:', 'ex: Fulano', '');

    const m = await modal.show(admin);
    if (m.canceled) return;

    const typedName = String(m.formValues[0] ?? '').trim();
    if (!typedName) {
      admin.sendMessage('§8digite um nome válido.');
      await showUnbanMenu(admin);
      return;
    }

    const res = banManager.unbanByAny(typedName, admin);
    const ok = res.removed > 0;
    admin.sendMessage(ok ? `§8${typedName} desbanido.` : '§8nome não encontrado na lista de banidos.');
    return;
  }

  if (r.selection === banned.length + 1) {
    await showMainMenu(admin);
    return;
  }

  const idx = r.selection - 1;
  const entry = banned[idx];
  if (!entry) {
    admin.sendMessage('§8entrada inválida.');
    return;
  }

  const ok = await banManager.unbanPlayer(entry.name, admin);
  admin.sendMessage(ok ? `§8${entry.name} desbanido.` : '§8falha ao desbanir.');
}

async function banPlayer(admin, targetMaybe) {
  // passa Player quando disponível; o banManager grava por NOME (sem kick)
  if (targetMaybe && targetMaybe.name) {
    const ok = await banManager.banPlayer(targetMaybe, admin);
    admin.sendMessage(ok ? `§8${targetMaybe.name} banido (sem kick).` : '§8já estava banido.');
    return;
  }
  const list = playerManager.getOnlinePlayers();
  const form = new ActionFormData()
    .title('§8banir jogador')
    .body('§8selecione o jogador:');
  list.forEach(p => form.button(p.name ?? p?.player?.name ?? 'desconhecido', 'textures/ui/icon_steve'));
  form.button('§8voltar', 'textures/ui/arrow_left');
  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === list.length) { await showPlayerManagement(admin); return; }
  const picked = list[r.selection];
  const target = picked?.player ?? picked;
  const ok = await banManager.banPlayer(target, admin);
  admin.sendMessage(ok ? `§8${target.name} banido (sem kick).` : '§8já estava banido.');
}

async function showGameModeMenu(player) {
  const form = new ActionFormData()
    .title('§8meu modo de jogo')
    .body('§8selecione seu modo:')
    .button('§8survival', 'textures/ui/hardcore/heart_half')
    .button('§8creative', 'textures/items/iron_pickaxe')
    .button('§8spectator', 'textures/ui/blindness_effect')
    .button('§8invisível', 'textures/ui/invisibility_effect')
    .button('§8voltar', 'textures/ui/arrow_left');

  const r = await form.show(player);
  if (r.canceled) return;
  if (r.selection === 4) { await showMainMenu(player); return; }

  switch (r.selection) {
    case 0: player.runCommand('gamemode survival'); break;
    case 1: player.runCommand('gamemode creative'); break;
    case 2: player.runCommand('gamemode spectator'); break;
    case 3: toggleInvisibility(player); break;
  }
  await showMainMenu(player);
}

async function toggleInvisibility(player) {
  try {
    const invisible = player.getDynamicProperty('admin_invisible') ? true : false;
    if (invisible) {
      player.runCommand('effect @s clear');
      player.setDynamicProperty('admin_invisible', false);
      player.sendMessage('§8modo invisível desativado.');
    } else {
      // duração grande, amplificador 1, "true" oculta partículas
      player.runCommand('effect @s invisibility 999999 1 true');
      player.setDynamicProperty('admin_invisible', true);
      player.sendMessage('§8modo invisível ativado.');
    }
  } catch {
    player.sendMessage('§8erro ao alternar invisibilidade.');
  }
  await showMainMenu(player);
}

/** ===== IMPORTANTE: sem auto-kick de banido no spawn =====
 *  (Quem estiver banido fica marcado no scoreboard; expulsão é manual.)
 */

/** =========================
 *  GERENCIAR teleporte
 *  ========================= */
async function showTeleportMenu(admin) {
  const list = playerManager.getOnlinePlayers();
  dbg(admin, `listando jogadores online (${list.length})`);
  const form = new ActionFormData()
    .title('§8teleportar jogadores')
    .body(`§8total: ${list.length}`);
  list.forEach(p => {
    const name = p?.name ?? p?.player?.name ?? 'desconhecido';
    form.button(name, 'textures/ui/icon_steve');
  });
  form.button('§8voltar', 'textures/ui/arrow_left');
  const r = await form.show(admin);
  if (r.canceled) return;
  if (r.selection === list.length) { await showMainMenu(admin); return; }
  const picked = list[r.selection];
  const target = picked?.player ?? picked;
  if (!target || !target.name) {
    admin.sendMessage('§8[debug] alvo inválido.');
    return;
  }
  dbg(admin, `selecionado para tp: ${target.name}`);
  try {
    (admin.runCommandAsync || admin.runCommand).call(admin, `tp "${admin.name}" "${target.name}"`);
    admin.sendMessage(`§8teleportado para ${target.name}.`);
  } catch {
    admin.sendMessage('§8falha ao teleportar.');
  }
}

console.warn('[Admin Panel] Sistema carregado com sucesso (kick desativado)!');
