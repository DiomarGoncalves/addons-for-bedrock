import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CN_COLORS } from "../../config/constants";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function colorLabel(colorId) {
  const c = CN_COLORS.find((x) => x.id === colorId);
  return c?.label ?? colorId;
}

export function colorsToDropdownIndex(colorId) {
  const idx = CN_COLORS.findIndex((c) => c.id === colorId);
  return idx >= 0 ? idx : 0;
}

export function dropdownIndexToColorId(index) {
  const idx = clamp(Number(index) || 0, 0, CN_COLORS.length - 1);
  return CN_COLORS[idx]?.id ?? CN_COLORS[0]?.id ?? "red";
}

// -------------- UI #1: choose mode --------------
export async function chooseChestModeUI(player) {
  const form = new ActionFormData()
    .title("Configurar Baú")
    .body("Escolha o modo de configuração:")
    .button("Baú de Entrada")
    .button("Gerenciar Redes")
    .button("Baú de Saída")
    .button("Cancelar");

  const res = await form.show(player);
  if (res.canceled) return null;
  if (res.selection === 0) return "in";
  if (res.selection === 1) return "manage";
  if (res.selection === 2) return "out";
  return null;
}

// -------------- UI: input link menu (Entrada = só vínculo) --------------
export async function inputMenuUI(player, currentLine) {
  const body = currentLine
    ? `Rede vinculada (Entrada):\n${currentLine}`
    : "Rede vinculada (Entrada):\n(nenhuma)";

  const form = new ActionFormData()
    .title("BAU DE ENTRADA")
    .body(body)
    .button("Vincular rede")
    .button("Desvincular rede")
    .button("Fechar");

  const res = await form.show(player);
  if (res.canceled) return null;
  return res.selection; // 0 link, 1 unlink, 2 close
}

// -------------- UI: output menu (Saída) --------------
export async function outputMenuUI(player, linkedLines) {
  const body = linkedLines.length
    ? `Baus Vinculados:\n${linkedLines.join("\n")}`
    : "Baus Vinculados:\n(nenhum)";

  const form = new ActionFormData()
    .title("BAU DE SAÍDA")
    .body(body)
    .button("Adicionar vínculo")
    .button("Remover vínculo")
    .button("Limpar tudo")
    .button("Salvar / Fechar");

  const res = await form.show(player);
  if (res.canceled) return null;
  return res.selection; // 0 add, 1 remove, 2 clear, 3 close
}

export async function askSearchTextUI(player) {
  const form = new ModalFormData()
    .title("Pesquisar redes")
    .textField("Pesquisar", "Digite parte do nome", "");
  return form.show(player);
}

export async function chooseNetworkFromListUI(player, networks, title) {
  const form = new ActionFormData().title(title).body("Selecione uma rede:");
  for (const n of networks) {
    const lock = n?.password ? " 🔒" : "";
    form.button(`${n.displayName} (${colorLabel(n.colorId)})${lock}`);
  }
  form.button("Cancelar");

  const res = await form.show(player);
  if (res.canceled) return null;
  if (res.selection === networks.length) return null;
  return networks[res.selection];
}

// -------------- UI: password prompt --------------
export async function askPasswordUI(player, title, hint) {
  const form = new ModalFormData()
    .title(title)
    .textField("Senha", hint ?? "Digite a senha da rede", "");
  return form.show(player);
}

// -------------- UI: network manager --------------
export async function manageNetworksMenuUI(player, lines) {
  const body = lines.length
    ? `Redes cadastradas:\n${lines.join("\n")}`
    : "Redes cadastradas:\n(nenhuma)";

  const form = new ActionFormData()
    .title("GERENCIAR REDES")
    .body(body)
    .button("Criar nova rede")
    .button("Editar rede")
    .button("Excluir rede")
    .button("Fechar");

  const res = await form.show(player);
  if (res.canceled) return null;
  return res.selection; // 0 create, 1 edit, 2 delete, 3 close
}

export async function createOrEditNetworkUI(player, title, name, colorId, hasPassword) {
  const form = new ModalFormData()
    .title(title)
    .textField("Nome da Rede", "Ex: Deposito", name ?? "")
    .dropdown(
      "Cor da Rede",
      CN_COLORS.map((c) => c.label),
      colorsToDropdownIndex(colorId)
    )
    .toggle("Proteger com senha", !!hasPassword)
    .textField("Senha (se marcada)", "Deixe vazio para não alterar (no editar)", "");

  return form.show(player);
}

export async function confirmUI(player, title, body, yesLabel = "Sim", noLabel = "Cancelar") {
  const form = new ActionFormData().title(title).body(body).button(yesLabel).button(noLabel);
  const res = await form.show(player);
  if (res.canceled) return false;
  return res.selection === 0;
}

export async function infoUI(player, title, body) {
  const form = new ActionFormData().title(title).body(body).button("OK");
  try {
    await form.show(player);
  } catch {}
}
