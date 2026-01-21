// ui/uiChain.js
// Compatível com @minecraft/server-ui 1.3.0
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CommandManager } from "../commandManager.js";
import { showMainMenu } from "./mainMenu.js";

function stepsOf(cmd) {
  return Array.isArray(cmd?.chainCommands) ? cmd.chainCommands : [];
}
function preview(steps) {
  const list = Array.isArray(steps) ? steps : [];
  if (!list.length) return "§8(Nenhum comando adicionado)";
  return list.map((s, i) => {
    const tag = s?.conditional ? "§8[COND]" : "§8[AUTO]";
    const nm = s?.name || `Passo ${i + 1}`;
    const ln = s?.command || "";
    return `§8${i + 1}. ${tag} §8${nm}\n§8   ${ln}`;
  }).join("\n");
}

/** Lista comandos do tipo "chain" */
export function showChainUI(player) {
  const list = CommandManager.getCommands(player).filter(c => c.type === "chain");

  const form = new ActionFormData()
    .title("§8 Cadeias de Comandos")
    .body(list.length ? "§8Selecione uma cadeia para gerenciar:" : "§8Você não possui cadeias salvas.");

  if (list.length === 0) {
    form.button("§8 Criar Nova Cadeia", "textures/ui/color_plus");
    form.button('§8voltar', 'textures/ui/arrow_left');
  } else {
    list.forEach(c => {
      const count = stepsOf(c).length;
      form.button(`§8 ${c.name} §8(${count} passo${count === 1 ? "" : "s"})`, "textures/ui/ChainSquare");
    });
    form.button("§8 Criar Nova Cadeia", "textures/ui/color_plus");
    form.button('§8voltar', 'textures/ui/arrow_left');
  }

  form.show(player).then(res => {
    if (res.canceled) return showMainMenu(player);

    if (list.length === 0) {
      if (res.selection === 0) return showChainForm(player); // criar
      return showMainMenu(player);
    }

    if (res.selection === list.length) return showChainForm(player);
    if (res.selection === list.length + 1) return showMainMenu(player);

    const chosen = list[res.selection];
    showChainActions(player, chosen);
  });
}

/** Tela de ações de uma cadeia específica */
function showChainActions(player, command) {
  const steps = stepsOf(command);
  const count = steps.length;

  const form = new ActionFormData()
    .title(`§8 ${command.name}`)
    .body(`§8Comandos em sequência: §8${count}\n\n${preview(steps)}`);

  form.button("§8 Executar Cadeia", "textures/ui/refresh");
  form.button("§8 Editar Cadeia", "textures/ui/book_edit_default");
  form.button("§8 Remover Cadeia", "textures/ui/trash");
  form.button('§8voltar', 'textures/ui/arrow_left');

  form.show(player).then(res => {
    if (res.canceled || res.selection === 3) return showChainUI(player);

    switch (res.selection) {
      case 0:
        CommandManager.executeChain(player, steps).then(() => { }).catch(() => { });
        showChainActions(player, command);
        break;
      case 1:
        showChainForm(player, command);
        break;
      case 2:
        CommandManager.removeCommand(player, command.id);
        showChainUI(player);
        break;
    }
  });
}

/** Formulário de criação/edição */
function showChainForm(player, existing = null) {
  const isEdit = !!existing;
  const data = existing ? { ...existing } : {
    name: "Nova Cadeia",
    type: "chain",
    chainCommands: []
  };

  const form = new ModalFormData()
    .title(isEdit ? "§8 Editar Cadeia" : "§8 Nova Cadeia")
    .textField("§8Nome da cadeia:", "Ex.: Farm básica", data.name)
    .dropdown("§8Ações", ["Gerenciar passos da cadeia", "Salvar"], 0);

  form.show(player).then(res => {
    if (res.canceled) return showChainUI(player);
    const [name, actionIdx] = res.formValues;

    data.name = String(name || "").trim() || data.name;

    if (actionIdx === 0) {
      showChainBuilderMenu(player, data, isEdit);
    } else {
      if (isEdit) CommandManager.updateCommand(player, data.id, data);
      else CommandManager.addCommand(player, data);
      showChainUI(player);
    }
  });
}

/** Construtor de passos (adicionar/remover/editar) */
function showChainBuilderMenu(player, data, isEdit) {
  const steps = stepsOf(data);
  const body =
    steps.length
      ? "§8Toque para editar um passo. Use os botões para adicionar/remover."
      : "§8Nenhum passo ainda. Adicione abaixo.";

  const form = new ActionFormData()
    .title(`§8 ${data.name} — passos`)
    .body(body);

  steps.forEach((s, i) => {
    const tag = s?.conditional ? "§8[COND]" : "§8[AUTO]";
    form.button(`§8 ${i + 1}. ${tag} §8${s?.name || "(sem nome)"}\n§8${s?.command || ""}`, "textures/ui/refresh");
  });

  form.button("§8 + Adicionar Passo", "textures/ui/color_plus");
  form.button("§8 - Remover Último", "textures/ui/trash");
  form.button('§8voltar', 'textures/ui/arrow_left');

  form.show(player).then(res => {
    if (res.canceled || res.selection === (steps.length + 2)) {
      // Voltar para o form anterior
      return showChainForm(player, isEdit ? data : null);
    }

    const addIdx = steps.length;
    const remIdx = steps.length + 1;

    if (res.selection === addIdx) {
      return showChainStepEditor(player, data, null, isEdit);
    }
    if (res.selection === remIdx) {
      if (steps.length) steps.pop();
      data.chainCommands = steps;
      return showChainBuilderMenu(player, data, isEdit);
    }

    // Editar item específico
    const idx = res.selection;
    showChainStepEditor(player, data, idx, isEdit);
  });
}

/** Editor de um passo da cadeia */
function showChainStepEditor(player, data, index = null, isEdit) {
  const steps = stepsOf(data);
  const exists = Number.isInteger(index) && steps[index];

  const cur = exists
    ? { ...steps[index] }
    : { name: "", command: "", conditional: false };

  const form = new ModalFormData()
    .title(exists ? `§8 Editar passo #${index + 1}` : "§8 Novo passo")
    .textField("§8Nome (opcional):", "Ex.: Dar item", cur.name || "")
    .textField("§8Comando:", "Ex.: /give @s diamond_sword", cur.command || "")
    .toggle("§8Só executa se o passo anterior tiver sucesso (condicional)?", !!cur.conditional);

  form.show(player).then(res => {
    if (res.canceled) return showChainBuilderMenu(player, data, isEdit);

    const [name, command, cond] = res.formValues;
    const next = {
      name: String(name || "").trim(),
      command: String(command || "").trim(),
      conditional: !!cond,
    };

    if (!next.command) {
      player.sendMessage("§8Informe um comando válido.");
      return showChainStepEditor(player, data, index, isEdit);
    }

    if (exists) steps[index] = next;
    else steps.push(next);

    data.chainCommands = steps;
    showChainBuilderMenu(player, data, isEdit);
  });
}
