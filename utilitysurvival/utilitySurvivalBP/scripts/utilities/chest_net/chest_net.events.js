import { world, system } from "@minecraft/server";
import { CONTAINER_BLOCK_IDS, WRENCH_ID, HOPPER_ID, EH_DEBUG } from "../../config/constants";
import {
  ensureRegistry,
  blockKey,
  getAllNetworks,
  getNetworkById,
  networkHasPassword,
  verifyNetworkPassword,
  upsertNetworkDef,
  removeNetworkDef,
  migrateNetworkId,
  deleteNetwork,
  setChestAsInput,
  removeChestInput,
  getChestInputNetId,
  getChestOutputNetIds,
  addChestOutput,
  removeChestOutput,
  clearChestOutputs,
} from "./chest_net.registry";
import {
  chooseChestModeUI,
  outputMenuUI,
  askSearchTextUI,
  chooseNetworkFromListUI,
  dropdownIndexToColorId,
  colorLabel,
  askPasswordUI,
  manageNetworksMenuUI,
  createOrEditNetworkUI,
  confirmUI,
  infoUI,
} from "./chest_net.ui";

const COOLDOWN_TICKS = 8;
const cooldown = new Map();

let TICK = 0;
system.runInterval(() => { TICK++; }, 1);

function isSneaking(player) {
  try {
    const v = player?.isSneaking;
    if (typeof v === "boolean") return v;
    if (typeof v === "function") return !!v.call(player);
  } catch {}
  return false;
}

function playerKey(player) {
  return player?.id ?? player?.name ?? "unknown";
}

function isContainerBlock(block) {
  if (!block) return false;
  // Preferir detecção por componente (funciona para baú, trapped, barrel, shulker, etc.)
  try {
    if (block.getComponent("inventory")?.container) return true;
  } catch {}
  try {
    if (block.getComponent("minecraft:inventory")?.container) return true;
  } catch {}
  try {
    return CONTAINER_BLOCK_IDS.includes(block.typeId);
  } catch {
    return false;
  }
}

function debug(player, msg) {
  if (!EH_DEBUG) return;
  try { player?.sendMessage(`§7[Utilities]§r ${msg}`); } catch {}
}

function slugify(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function netIdFor(name, colorId) {
  const slug = slugify(name);
  return `net:${colorId}:${slug || "sem_nome"}`;
}

async function requirePasswordIfNeeded(player, registry, netId) {
  // IMPORTANT:
  // Some worlds may end up with duplicated network-def tags from older versions.
  // To be robust, prefer the password on the resolved definition (if any).
  const def = getNetworkById(registry, netId);
  const real = String(def?.password ?? "").trim();
  if (!real) return true; // no password => always ok

  const label = def ? `${def.displayName} (${colorLabel(def.colorId)})` : netId;
  const res = await askPasswordUI(player, "SENHA DA REDE", `Rede: ${label}`);
  if (!res || res.canceled) return false;

  const [pwdRaw] = res.formValues;
  const attempt = String(pwdRaw ?? "").trim();
  const ok = attempt === real;
  if (!ok) {
    await infoUI(player, "SENHA INCORRETA", "Senha inválida. Operação cancelada.");
    return false;
  }
  return true;
}

async function manageNetworks(player, registry) {
  const linesFor = () => {
    const nets = getAllNetworks(registry);
    const lines = nets.map((n) => {
      const lock = n.password ? " 🔒" : "";
      return `• ${n.displayName} (${colorLabel(n.colorId)})${lock}`;
    });
    return { nets, lines };
  };

  const { nets, lines } = linesFor();
  const choice = await manageNetworksMenuUI(player, lines);
  if (choice === null || choice === 3) return;

  // CREATE
  if (choice === 0) {
    const res = await createOrEditNetworkUI(player, "CRIAR REDE", "", "red", false);
    if (!res || res.canceled) return;
    const [nameRaw, colorIndexRaw, protectRaw, pwdRaw] = res.formValues;
    const name = String(nameRaw ?? "").trim();
    const colorId = dropdownIndexToColorId(colorIndexRaw);
    const protect = !!protectRaw;
    const pwd = protect ? String(pwdRaw ?? "").trim() : "";

    if (!name) {
      player.sendMessage("§cInforme um nome para a rede.");
      return;
    }
    if (protect && !pwd) {
      player.sendMessage("§cVocê marcou proteção com senha, mas não informou a senha.");
      return;
    }

    const netId = netIdFor(name, colorId);
    const existing = getNetworkById(registry, netId);
    if (existing) {
      player.sendMessage("§cJá existe uma rede com esse Nome+Cor. Use EDITAR para alterar.");
      return;
    }

    upsertNetworkDef(registry, netId, name, colorId, pwd);
    player.sendMessage(`§aRede criada com sucesso: ${name}`);
    return;
  }

  // EDIT
  if (choice === 1) {
    if (nets.length === 0) {
      player.sendMessage("§cNenhuma rede cadastrada.");
      return;
    }
    const picked = await chooseNetworkFromListUI(player, nets.slice(0, 20), "Editar rede");
    if (!picked) return;

    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    const res = await createOrEditNetworkUI(
      player,
      "EDITAR REDE",
      picked.displayName,
      picked.colorId,
      !!picked.password
    );
    if (!res || res.canceled) return;

    const [nameRaw, colorIndexRaw, protectRaw, pwdRaw] = res.formValues;
    const newName = String(nameRaw ?? "").trim();
    const newColorId = dropdownIndexToColorId(colorIndexRaw);
    const protect = !!protectRaw;
    const pwdField = String(pwdRaw ?? "");

    if (!newName) {
      player.sendMessage("§cInforme um nome para a rede.");
      return;
    }

    const newNetId = netIdFor(newName, newColorId);

    let nextPwd = "";
    if (protect) {
      if (String(pwdField).trim()) nextPwd = String(pwdField).trim();
      else if (picked.password) nextPwd = picked.password;
      else nextPwd = ""; 
    }

    if (protect && !nextPwd) {
      player.sendMessage("§cVocê marcou proteção com senha, mas não informou a senha.");
      return;
    }

    if (newNetId !== picked.netId) {
      const dest = getNetworkById(registry, newNetId);
      if (dest) {
        player.sendMessage("§cJá existe outra rede com esse Nome+Cor. Escolha outra combinação.");
        return;
      }
      migrateNetworkId(registry, picked.netId, newNetId);
    }

    upsertNetworkDef(registry, newNetId, newName, newColorId, nextPwd);

    if (newNetId !== picked.netId) {
      removeNetworkDef(registry, picked.netId);
    }

    player.sendMessage(`§aRede atualizada: ${newName}`);
    return;
  }

  // DELETE
  if (choice === 2) {
    if (nets.length === 0) {
      player.sendMessage("§cNenhuma rede cadastrada.");
      return;
    }

    const picked = await chooseNetworkFromListUI(player, nets.slice(0, 20), "Excluir rede");
    if (!picked) return;

    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    const ok = await confirmUI(
      player,
      "EXCLUIR REDE",
      `Tem certeza que deseja excluir a rede:\n${picked.displayName} (${colorLabel(picked.colorId)})\n\nIsso removerá TODOS os vínculos (entradas/saídas) dessa rede.`,
      "Excluir",
      "Cancelar"
    );
    if (!ok) return;

    deleteNetwork(registry, picked.netId);
    player.sendMessage("§cRede excluída com sucesso.");
    return;
  }
}

async function handleChestConfig(player, block) {
  const registry = ensureRegistry();
  const cKey = blockKey(block);

  const mode = await chooseChestModeUI(player);
  if (!mode) return;

  // -----------------
  // MANAGE NETWORKS
  // -----------------
  if (mode === "manage") {
    await manageNetworks(player, registry);
    return;
  }

  // -----------------
  // INPUT CONFIG
  // -----------------
  if (mode === "in") {
    const nets = getAllNetworks(registry);

    if (nets.length === 0) {
      player.sendMessage("§cNenhuma rede cadastrada. Crie uma rede em GERENCIAR REDES.");
      return;
    }

    const sr = await askSearchTextUI(player);
    if (!sr || sr.canceled) return;
    const [queryRaw] = sr.formValues;
    const q = String(queryRaw ?? "").trim().toLowerCase();

    const filtered = nets
      .filter((n) => (q ? n.displayName.toLowerCase().includes(q) : true))
      .slice(0, 20);

    if (filtered.length === 0) {
      player.sendMessage("§cNenhuma rede encontrada com esse nome.");
      return;
    }

    const picked = await chooseNetworkFromListUI(player, filtered, "Vincular como ENTRADA");
    if (!picked) return;

    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    setChestAsInput(registry, cKey, picked.netId);
    player.sendMessage(`§aVinculado como ENTRADA da rede: ${picked.displayName}`);
    return;
  }

  // Safety: if something unexpected happens (API differences, weird selection values),
  // don't accidentally fall into the output UI.
  if (mode !== "out") return;

  // -----------------
  // OUTPUT CONFIG
  // -----------------
  const refresh = () => {
    const nets = getAllNetworks(registry);
    const outIds = getChestOutputNetIds(registry, cKey);
    const lines = [];
    for (const id of outIds) {
      const hit = nets.find((n) => n.netId === id);
      if (hit) {
        const lock = hit.password ? " 🔒" : "";
        lines.push(`• ${hit.displayName} (${colorLabel(hit.colorId)})${lock}`);
      } else {
        lines.push(`• ${id}`);
      }
    }
    return { nets, outIds, lines };
  };

  const { nets, outIds, lines } = refresh();
  const choice = await outputMenuUI(player, lines);
  if (choice === null || choice === 3) return;

  // ADD
  if (choice === 0) {
    if (nets.length === 0) {
      player.sendMessage("§cNenhum link disponível. Crie uma rede em GERENCIAR.");
      return;
    }

    const sr = await askSearchTextUI(player);
    if (!sr || sr.canceled) return;
    const [queryRaw] = sr.formValues;
    const q = String(queryRaw ?? "").trim().toLowerCase();

    const filtered = nets
      .filter((n) => (q ? n.displayName.toLowerCase().includes(q) : true))
      .filter((n) => !outIds.includes(n.netId))
      .slice(0, 20);

    if (filtered.length === 0) {
      player.sendMessage("§cNenhum link encontrado (ou já vinculado).");
      return;
    }

    const picked = await chooseNetworkFromListUI(player, filtered, "Adicionar vínculo");
    if (!picked) return;

    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    addChestOutput(registry, cKey, picked.netId);
    player.sendMessage(`§aVínculo adicionado na rede: ${picked.displayName}`);
    return;
  }

  // REMOVE
  if (choice === 1) {
    if (outIds.length === 0) {
      player.sendMessage("§cNenhum vínculo para remover.");
      return;
    }

    const candidates = outIds
      .map((id) => nets.find((n) => n.netId === id) ?? { netId: id, displayName: id, colorId: "", password: "" })
      .slice(0, 20);

    const picked = await chooseNetworkFromListUI(player, candidates, "Remover vínculo");
    if (!picked) return;

    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    removeChestOutput(registry, cKey, picked.netId);
    player.sendMessage(`§cVínculo removido da rede: ${picked.displayName}`);
    return;
  }

  // CLEAR
  if (choice === 2) {
    const ok = await confirmUI(
      player,
      "LIMPAR VÍNCULOS",
      "Tem certeza que deseja limpar todos os vínculos deste BAÚ DE SAÍDA?",
      "Limpar",
      "Cancelar"
    );
    if (ok) {
      clearChestOutputs(registry, cKey);
      player.sendMessage("§eTodos os vínculos foram limpos.");
    }
    return;
  }
}

world.beforeEvents.itemUseOn.subscribe((ev) => {
  const player = ev?.source;
  const block = ev?.block;
  const item = ev?.itemStack;

  if (!player || !block || !item) return;
  if (item.typeId !== WRENCH_ID) return;
  // HOPPER é gerenciado pela UI do Ender/Vacuum Hopper (wrench.events.js)
  if (block.typeId === HOPPER_ID) return;
  if (!isContainerBlock(block)) return;
  if (!isSneaking(player)) return;

  const pk = playerKey(player);
  const last = cooldown.get(pk) ?? -999999;
  if (TICK - last < COOLDOWN_TICKS) {
    try { ev.cancel = true; } catch {}
    return;
  }
  cooldown.set(pk, TICK);

  try { ev.cancel = true; } catch {}

  system.run(() => {
    handleChestConfig(player, block).catch((err) => {
      if (EH_DEBUG) console.warn(`[ChestNet] erro ao abrir UI: ${err}`);
    });
  });
});
