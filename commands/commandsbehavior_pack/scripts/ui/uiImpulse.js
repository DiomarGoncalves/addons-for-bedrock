// ui/uiImpulse.js
// Compatível com @minecraft/server-ui 1.3.0
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CommandManager } from "../commandManager.js";
import { showMainMenu } from "./mainMenu.js";

/** Lista comandos do tipo "impulse" */
export function showImpulseUI(player) {
  const list = CommandManager.getCommands(player).filter(c => c.type === "impulse");

  const form = new ActionFormData()
    .title("§8 Comandos — Impulso")
    .body(list.length ? "§8Selecione um comando para gerenciar:" : "§8Você não possui comandos de Impulso.");

  if (!list.length) {
    form.button("§8 Criar Novo", "textures/ui/color_plus");
    form.button('§8voltar', 'textures/ui/arrow_left');
  } else {
    list.forEach(c => {
      form.button(`§8 ${c.name}\n§8${c.command || ""}`, "textures/ui/ImpulseSquare");
    });
    form.button("§8 Criar Novo", "textures/ui/color_plus");
    form.button('§8voltar', 'textures/ui/arrow_left');
  }

  form.show(player).then(res => {
    if (res.canceled) return showMainMenu(player);

    if (!list.length) {
      if (res.selection === 0) return showImpulseForm(player);
      return showMainMenu(player);
    }

    if (res.selection === list.length) return showImpulseForm(player);
    if (res.selection === list.length + 1) return showMainMenu(player);

    const chosen = list[res.selection];
    showImpulseActions(player, chosen);
  });
}

/** Ações de um único comando de impulso */
function showImpulseActions(player, cmd) {
  const form = new ActionFormData()
    .title(`§8 ${cmd.name}`)
    .body(`§8${cmd.command || ""}`);

  form.button("§8 Executar Agora", "textures/ui/refresh");
  form.button("§8 Editar", "textures/ui/book_edit_default");
  form.button("§8 Remover", "textures/ui/trash");
  form.button('§8voltar', 'textures/ui/arrow_left');

  form.show(player).then(res => {
    if (res.canceled || res.selection === 3) return showImpulseUI(player);

    switch (res.selection) {
      case 0:
        // <- Aqui acontecia o "not a function" (agora existe CommandManager.executeImpulse)
        CommandManager.executeImpulse(player, cmd.command).then(ok => {
          if (!ok) player.sendMessage("§8Falha ao executar.");
        });
        showImpulseActions(player, cmd);
        break;
      case 1:
        showImpulseForm(player, cmd);
        break;
      case 2:
        CommandManager.removeCommand(player, cmd.id);
        showImpulseUI(player);
        break;
    }
  });
}

/** Criar/Editar comando de impulso */
function showImpulseForm(player, existing = null) {
  const isEdit = !!existing;
  const data = existing ? { ...existing } : {
    type: "impulse",
    name: "Novo Comando",
    command: "",
  };

  const form = new ModalFormData()
    .title(isEdit ? "§8 Editar Impulso" : "§8 Novo Impulso")
    .textField("§8Nome:", "Ex.: Dar espada", data.name)
    .textField("§8Comando:", "Ex.: /give @s diamond_sword", data.command);

  form.show(player).then(res => {
    if (res.canceled) return showImpulseUI(player);
    const [name, command] = res.formValues;

    const nm = String(name || "").trim();
    const ln = String(command || "").trim();
    if (!ln) {
      player.sendMessage("§8Informe um comando válido.");
      return showImpulseForm(player, existing);
    }

    if (isEdit) {
      CommandManager.updateCommand(player, data.id, { name: nm || data.name, command: ln });
    } else {
      CommandManager.addCommand(player, { ...data, name: nm || data.name, command: ln });
    }
    showImpulseUI(player);
  });
}
