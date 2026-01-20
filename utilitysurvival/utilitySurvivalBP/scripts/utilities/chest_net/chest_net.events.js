import { world, system } from "@minecraft/server";
import { CHEST_ID, WRENCH_ID } from "../../config/constants";
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

  while (true) {
    const { nets, lines } = linesFor();
    const choice = await manageNetworksMenuUI(player, lines);
    if (choice === null || choice === 3) return;

    // CREATE
    if (choice === 0) {
      const res = await createOrEditNetworkUI(player, "CRIAR REDE", "", "red", false);
      if (!res || res.canceled) continue;
      const [nameRaw, colorIndexRaw, protectRaw, pwdRaw] = res.formValues;
      const name = String(nameRaw ?? "").trim();
      const colorId = dropdownIndexToColorId(colorIndexRaw);
      const protect = !!protectRaw;
      const pwd = protect ? String(pwdRaw ?? "").trim() : "";

      if (!name) {
        await infoUI(player, "CRIAR REDE", "Informe um nome para a rede.");
        continue;
      }
      if (protect && !pwd) {
        await infoUI(player, "CRIAR REDE", "Você marcou proteção com senha, mas não informou a senha.");
        continue;
      }

      const netId = netIdFor(name, colorId);
      const existing = getNetworkById(registry, netId);
      if (existing) {
        await infoUI(player, "CRIAR REDE", "Já existe uma rede com esse Nome+Cor. Use EDITAR para alterar.");
        continue;
      }

      upsertNetworkDef(registry, netId, name, colorId, pwd);
      await infoUI(player, "CRIAR REDE", `Rede criada:\n${name} (${colorLabel(colorId)})`);
      continue;
    }

    // EDIT
    if (choice === 1) {
      if (nets.length === 0) {
        await infoUI(player, "EDITAR REDE", "Nenhuma rede cadastrada.");
        continue;
      }
      const picked = await chooseNetworkFromListUI(player, nets.slice(0, 20), "Editar rede");
      if (!picked) continue;

      const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
      if (!okPwd) continue;

      const res = await createOrEditNetworkUI(
        player,
        "EDITAR REDE",
        picked.displayName,
        picked.colorId,
        !!picked.password
      );
      if (!res || res.canceled) continue;

      const [nameRaw, colorIndexRaw, protectRaw, pwdRaw] = res.formValues;
      const newName = String(nameRaw ?? "").trim();
      const newColorId = dropdownIndexToColorId(colorIndexRaw);
      const protect = !!protectRaw;
      const pwdField = String(pwdRaw ?? "");

      if (!newName) {
        await infoUI(player, "EDITAR REDE", "Informe um nome para a rede.");
        continue;
      }

      const newNetId = netIdFor(newName, newColorId);

      // password rules:
      // - if protect=false => remove password
      // - if protect=true and field empty => keep existing password (when already protected)
      // - if protect=true and field non-empty => set/replace
      let nextPwd = "";
      if (protect) {
        if (String(pwdField).trim()) nextPwd = String(pwdField).trim();
        else if (picked.password) nextPwd = picked.password;
        else nextPwd = ""; // new protected but empty => not allowed
      }

      if (protect && !nextPwd) {
        await infoUI(player, "EDITAR REDE", "Você marcou proteção com senha, mas não informou a senha.");
        continue;
      }

      // If netId changes, ensure destination doesn't collide
      if (newNetId !== picked.netId) {
        const dest = getNetworkById(registry, newNetId);
        if (dest) {
          await infoUI(player, "EDITAR REDE", "Já existe outra rede com esse Nome+Cor. Escolha outra combinação.");
          continue;
        }
        // migrate mappings
        migrateNetworkId(registry, picked.netId, newNetId);
      }

      upsertNetworkDef(registry, newNetId, newName, newColorId, nextPwd);

      if (newNetId !== picked.netId) {
        // remove old def only (mappings already migrated)
        removeNetworkDef(registry, picked.netId);
      }

      await infoUI(player, "EDITAR REDE", `Rede atualizada:\n${newName} (${colorLabel(newColorId)})`);
      continue;
    }

    // DELETE
    if (choice === 2) {
      if (nets.length === 0) {
        await infoUI(player, "EXCLUIR REDE", "Nenhuma rede cadastrada.");
        continue;
      }

      const picked = await chooseNetworkFromListUI(player, nets.slice(0, 20), "Excluir rede");
      if (!picked) continue;

      const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
      if (!okPwd) continue;

      const ok = await confirmUI(
        player,
        "EXCLUIR REDE",
        `Tem certeza que deseja excluir a rede:\n${picked.displayName} (${colorLabel(picked.colorId)})\n\nIsso removerá TODOS os vínculos (entradas/saídas) dessa rede.`,
        "Excluir",
        "Cancelar"
      );
      if (!ok) continue;

      deleteNetwork(registry, picked.netId);
      await infoUI(player, "EXCLUIR REDE", "Rede excluída com sucesso.");
      continue;
    }
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
      await infoUI(player, "BAU DE ENTRADA", "Nenhuma rede cadastrada. Crie uma rede em GERENCIAR REDES.");
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
      await infoUI(player, "BAU DE ENTRADA", "Nenhuma rede encontrada com esse nome.");
      return;
    }

    const picked = await chooseNetworkFromListUI(player, filtered, "Vincular como ENTRADA");
    if (!picked) return;

    // ✅ SEMPRE pede senha se a rede for protegida
    const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
    if (!okPwd) return;

    // setChestAsInput já trava (limpa saídas)
    setChestAsInput(registry, cKey, picked.netId);

    await infoUI(
      player,
      "BAU DE ENTRADA",
      `Vinculado como ENTRADA da rede:\n${picked.displayName} (${colorLabel(picked.colorId)})${picked.password ? "\n\n(Protegido com senha 🔒)" : ""}`
    );
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

  while (true) {
    const { nets, outIds, lines } = refresh();
    const choice = await outputMenuUI(player, lines);
    if (choice === null || choice === 3) return;

    // ADD
    if (choice === 0) {
      if (nets.length === 0) {
        await infoUI(player, "BAU DE SAÍDA", "Nenhum link cadastrado. Configure um BAU DE ENTRADA ou crie uma rede no GERENCIAR.");
        continue;
      }

      const sr = await askSearchTextUI(player);
      if (!sr || sr.canceled) continue;
      const [queryRaw] = sr.formValues;
      const q = String(queryRaw ?? "").trim().toLowerCase();

      const filtered = nets
        .filter((n) => (q ? n.displayName.toLowerCase().includes(q) : true))
        .filter((n) => !outIds.includes(n.netId))
        .slice(0, 20);

      if (filtered.length === 0) {
        await infoUI(player, "BAU DE SAÍDA", "Nenhum link encontrado (ou já vinculado)." );
        continue;
      }

      const picked = await chooseNetworkFromListUI(player, filtered, "Adicionar vínculo");
      if (!picked) continue;

      // ✅ Agora SEMPRE pede senha se a rede for protegida
      const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
      if (!okPwd) continue;

      // addChestOutput já trava (remove ENTRADA do mesmo baú)
      addChestOutput(registry, cKey, picked.netId);

      await infoUI(
        player,
        "BAU DE SAÍDA",
        `Vínculo adicionado:\n${picked.displayName} (${colorLabel(picked.colorId)})`
      );
      continue;
    }

    // REMOVE
    if (choice === 1) {
      if (outIds.length === 0) {
        await infoUI(player, "BAU DE SAÍDA", "Nenhum vínculo para remover.");
        continue;
      }

      const candidates = outIds
        .map((id) => nets.find((n) => n.netId === id) ?? { netId: id, displayName: id, colorId: "", password: "" })
        .slice(0, 20);

      const picked = await chooseNetworkFromListUI(player, candidates, "Remover vínculo");
      if (!picked) continue;

      const okPwd = await requirePasswordIfNeeded(player, registry, picked.netId);
      if (!okPwd) continue;

      removeChestOutput(registry, cKey, picked.netId);
      continue;
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
      if (ok) clearChestOutputs(registry, cKey);
      continue;
    }
  }
}

world.beforeEvents.itemUseOn.subscribe((ev) => {
  const player = ev?.source;
  const block = ev?.block;
  const item = ev?.itemStack;

  if (!player || !block || !item) return;
  if (item.typeId !== WRENCH_ID) return;
  if (block.typeId !== CHEST_ID) return;
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
    handleChestConfig(player, block).catch(() => {});
  });
});
