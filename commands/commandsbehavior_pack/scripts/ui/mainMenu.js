import { ActionFormData } from "@minecraft/server-ui";
import { CommandManager } from "../commandManager.js";
import { showImpulseUI } from "./uiImpulse.js";
import { showRepeatUI } from "./uiRepeat.js";
import { showChainUI } from "./uiChain.js";

export function showMainMenu(player) {
    if (!player.hasTag("comandos")) {
        player.sendMessage("§8 Você não tem permissão para usar este painel.");
        return;
    }

    const form = new ActionFormData()
        .title("§8Painel de Comandos Avançado")
        .body("§8Gerencie comandos personalizados como blocos de comando virtuais.\n\n§8Selecione uma opção:");

    form.button("§8 Comando Impulso\n§8Executa uma vez", "textures/ui/ImpulseSquare");
    form.button("§8 Comando de Repetição\n§8Loop automático", "textures/ui/RepeatSquare");
    form.button("§8 Comando em Cadeia\n§8Sequência de comandos", "textures/ui/ChainSquare");
    form.button("§8 Novo Comando\n§8Criar comando personalizado", "textures/ui/color_plus");
    form.button("§8 Remover Comando\n§8Deletar comando salvo", "textures/ui/trash");
    form.button("§8 Listar Comandos\n§8Ver todos os comandos", "textures/ui/feedIcon");

    form.show(player).then(response => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                showImpulseUI(player);
                break;
            case 1:
                showRepeatUI(player);
                break;
            case 2:
                showChainUI(player);
                break;
            case 3:
                showNewCommandUI(player);
                break;
            case 4:
                showRemoveCommandUI(player);
                break;
            case 5:
                showListCommandsUI(player);
                break;
        }
    });
}

function showNewCommandUI(player) {
    const form = new ActionFormData()
        .title("§8 Criar Novo Comando")
        .body("§8Selecione o tipo de comando que deseja criar:");

    form.button("§8 Impulso", "textures/ui/ImpulseSquare");
    form.button("§8 Repetição", "textures/ui/RepeatSquare");
    form.button("§8 Cadeia", "textures/ui/ChainSquare");
    form.button('§8voltar', 'textures/ui/arrow_left');

    form.show(player).then(response => {
        if (response.canceled || response.selection === 3) {
            showMainMenu(player);
            return;
        }

        switch (response.selection) {
            case 0:
                showImpulseUI(player, true);
                break;
            case 1:
                showRepeatUI(player, true);
                break;
            case 2:
                showChainUI(player, true);
                break;
        }
    });
}

function showRemoveCommandUI(player) {
    const commands = CommandManager.getCommands(player);

    if (commands.length === 0) {
        player.sendMessage("§8Você não possui comandos salvos.");
        showMainMenu(player);
        return;
    }

    const form = new ActionFormData()
        .title("§8 Remover Comando")
        .body("§8Selecione o comando que deseja remover:");

    commands.forEach(cmd => {
        const typeIcon = cmd.type === "impulse" ? "" : cmd.type === "repeat" ? "" : "";
        const status = CommandManager.isRepeating(cmd.id) ? "§8[ATIVO]" : "";
        form.button(`${typeIcon} ${cmd.name}\n§8${cmd.command.substring(0, 30)}... ${status}`);
    });

    form.button('§8voltar', 'textures/ui/arrow_left');

    form.show(player).then(response => {
        if (response.canceled || response.selection === commands.length) {
            showMainMenu(player);
            return;
        }

        const selectedCommand = commands[response.selection];
        CommandManager.removeCommand(player, selectedCommand.id);
        showMainMenu(player);
    });
}

function showListCommandsUI(player) {
    const commands = CommandManager.getCommands(player);

    if (commands.length === 0) {
        player.sendMessage("§8Você não possui comandos salvos.");
        showMainMenu(player);
        return;
    }

    let body = "§8Seus comandos salvos:\n\n";
    commands.forEach((cmd, index) => {
        const typeIcon = cmd.type === "impulse" ? "§8" : cmd.type === "repeat" ? "§8" : "§8";
        const status = CommandManager.isRepeating(cmd.id) ? "§8[ATIVO]" : "§8[INATIVO]";
        body += `§8${index + 1}. ${typeIcon} §8${cmd.name} ${status}\n§8   ${cmd.command}\n\n`;
    });

    const form = new ActionFormData()
        .title("§8 Lista de Comandos")
        .body(body)
    form.button('§8voltar', 'textures/ui/arrow_left');

    form.show(player).then(() => {
        showMainMenu(player);
    });
}
