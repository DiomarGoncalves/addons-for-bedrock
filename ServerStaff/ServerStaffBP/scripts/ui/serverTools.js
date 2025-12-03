
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Config } from "../config";
import { buildJailStructure } from "../features/jail";
import { openGameRulesMenu } from "./gamerulesMenu";
import { openWorldMenu } from "./worldMenu";
import { openEntityMenu } from "./entityMenu";

export function openServerTools(player) {
    const isGlobalMute = world.getDynamicProperty(Config.GLOBAL_MUTE_TAG);
    const isMaintenance = world.getDynamicProperty(Config.MAINTENANCE_TAG);

    const form = new ActionFormData()
        .title("§8Painel de Controle")
        .body("§7Selecione uma categoria de gerenciamento.")
        .button("§8Mundo (Tempo/Clima)")
        .button("§8GameRules (Regras)")
        .button("§8Entidades (Lag)")
        .button(isGlobalMute ? "§fChat: TRAVADO" : "§8Chat: LIVRE")
        .button(isMaintenance ? "§fManutencao: ON" : "§8Manutencao: OFF")
        .button("§8Construir Jaula (Manual)");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: // Mundo
                openWorldMenu(player);
                break;
            case 1: // GameRules
                openGameRulesMenu(player);
                break;
            case 2: // Entidades
                openEntityMenu(player);
                break;
            case 3: // Global Mute
                const newMute = !isGlobalMute;
                world.setDynamicProperty(Config.GLOBAL_MUTE_TAG, newMute);
                world.sendMessage(Config.PREFIX + (newMute ? "O Chat foi TRAVADO pelo Staff." : "O Chat foi LIBERADO."));
                break;
            case 4: // Maintenance
                const newMaint = !isMaintenance;
                world.setDynamicProperty(Config.MAINTENANCE_TAG, newMaint);
                if (newMaint) {
                    world.sendMessage(Config.PREFIX + "§fModo Manutencao ATIVADO.");
                } else {
                    world.sendMessage(Config.PREFIX + "Modo Manutencao DESATIVADO.");
                }
                break;
            case 5: // Jail
                buildJailStructure();
                player.sendMessage(Config.PREFIX + "Construindo jaula...");
                break;
        }
    });
}