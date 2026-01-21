// ui/uiRepeat.js
// Compatível com @minecraft/server-ui 1.3.0
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CommandManager } from "../commandManager.js";
import { showMainMenu } from "./mainMenu.js";

function fmtPreview(line, max = 30) {
  const txt = String(line || "");
  if (txt.length <= max) return txt;
  return txt.slice(0, max) + "...";
}

/**
 * Lista/Criação de comandos de repetição.
 * - Se isCreating = true, abre diretamente o formulário de criação.
 * - Se não houver comandos salvos, também abre o formulário de criação.
 * - Em cancel (X/ESC) a UI FECHA (não volta).
 */
export function showRepeatUI(player, isCreating = false) {
  const list = CommandManager.getCommands(player).filter(c => c.type === "repeat");

  // Se pediram para criar agora, vai direto ao form
  if (isCreating) {
    return showRepeatForm(player);
  }

  // Se não há comandos, abrir criação automaticamente
  if (list.length === 0) {
    return showRepeatForm(player);
  }

  const form = new ActionFormData()
    .title("§8 Comandos de Repetição")
    .body("§8Selecione um comando para gerenciar:");

  list.forEach(c => {
    const status = CommandManager.isRepeating(c.id) ? "§8[ATIVO]" : "§8[PARADO]";
    form.button(`§8 ${c.name} ${status}\n§8${fmtPreview(c.command)}`, "textures/ui/RepeatSquare");
  });

  form.button("§8 Criar Novo", "textures/ui/color_plus");
  form.button('§8voltar', 'textures/ui/arrow_left');

  form.show(player).then(res => {
    // Cancel → FECHA
    if (res.canceled) return;

    // Ações de rodapé
    if (res.selection === list.length) {
      return showRepeatForm(player);
    }
    if (res.selection === list.length + 1) {
      // Voltar explicitamente
      return showMainMenu(player);
    }

    const chosen = list[res.selection];
    showRepeatActions(player, chosen);
  });
}

/**
 * Formulário de criação/edição de repetição.
 * - Em cancel (X/ESC) a UI FECHA (não volta).
 * - Slider de 1 a 200 ticks (20 ticks ≈ 1s).
 */
function showRepeatForm(player, existing = null) {
  const isEdit = !!existing;
  const data = existing ? { ...existing } : {
    type: "repeat",
    name: "Comando de Repetição",
    command: "",
    delay: 20,
    conditional: false,
  };

  const form = new ModalFormData()
    .title(isEdit ? "§8 Editar Comando de Repetição" : "§8 Novo Comando de Repetição")
    .textField("§8Nome do Comando:", "Ex.: Dar item a cada 5s", data.name)
    .textField("§8Comando (sem /):", "Ex.: give @s apple 1", data.command?.replace(/^\//, "") || "")
    .textField(
      "§8Atraso em ticks (20 ticks = 1 segundo):",
      "Ex.: 20, 200, 1000",
      String(Number.isFinite(data.delay) ? data.delay : 20)
    )

    .toggle("§8Condicional (executar apenas se a última execução teve sucesso)", !!data.conditional);

  form.show(player).then(res => {
    // Cancel → FECHA
    if (res.canceled) return;

    const [name, commandRaw, delayRaw, conditional] = res.formValues;

    const delay = Math.max(1, Math.floor(Number(delayRaw)));
    if (!Number.isFinite(delay)) {
      player.sendMessage("§8Erro: atraso inválido. Use apenas números.");
      return showRepeatForm(player, existing);
    }


    const nm = String(name || "").trim() || "Comando de Repetição";
    const cmd = String(commandRaw || "").trim();
    if (!cmd) {
      player.sendMessage("§8Erro: o comando não pode estar vazio.");
      return showRepeatForm(player, existing);
    }

    const payload = {
      name: nm,
      type: "repeat",
      command: cmd.startsWith("/") ? cmd : `/${cmd}`,
      delay: Math.max(1, Math.floor(delay || 20)),
      conditional: !!conditional,
    };

    if (isEdit) {
      const wasRunning = CommandManager.isRepeating(existing.id);
      if (wasRunning) CommandManager.stopRepeatingCommand(existing.id);

      CommandManager.updateCommand(player, existing.id, payload);
      player.sendMessage("§8Comando de repetição atualizado.");

      if (wasRunning) {
        const updated = CommandManager.getCommandById(player, existing.id);
        CommandManager.startRepeatingCommand(player, updated.id, updated.command, updated.delay);
      }
    } else {
      CommandManager.addCommand(player, payload);
      player.sendMessage("§8Comando de repetição criado.");
    }

    // Após salvar, volta para a lista (se quiser fechar, basta remover esta linha)
    showRepeatUI(player);
  });
}

/**
 * Tela de ações de um comando de repetição.
 * - Em cancel (X/ESC) a UI FECHA (não volta).
 */
function showRepeatActions(player, command) {
  const isRunning = CommandManager.isRepeating(command.id);
  const seconds = (Number(command.delay || 20) / 20).toFixed(1);

  const form = new ActionFormData()
    .title(`§8 ${command.name}`)
    .body(
      `§8Comando: §f${String(command.command || "")}\n` +
      `§8Intervalo: §f${command.delay} ticks (${seconds}s)\n` +
      `§8Status: §f${isRunning ? "ATIVO" : "PARADO"}\n` +
      `§8Condicional: §f${command.conditional ? "Sim" : "Não"}`
    );

  if (isRunning) form.button("§8 Parar Execução", "textures/ui/cancel");
  else form.button("§8 Iniciar Execução", "textures/ui/refresh");

  form.button("§8 Editar", "textures/ui/book_edit_default");
  form.button("§8 Remover", "textures/ui/trash");
  form.button('§8voltar', 'textures/ui/arrow_left');

  form.show(player).then(res => {
    // Cancel → FECHA
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        if (isRunning) {
          CommandManager.stopRepeatingCommand(command.id);
          player.sendMessage("§8Execução parada.");
        } else {
          CommandManager.startRepeatingCommand(player, command.id, command.command, command.delay);
          player.sendMessage("§8Execução iniciada.");
        }
        // Reabre a tela para refletir o novo status
        showRepeatActions(player, command);
        break;

      case 1:
        showRepeatForm(player, command);
        break;

      case 2:
        CommandManager.removeCommand(player, command.id);
        player.sendMessage("§8Comando removido.");
        showRepeatUI(player);
        break;

      case 3:
        // Voltar explicitamente
        showRepeatUI(player);
        break;
    }
  });
}
