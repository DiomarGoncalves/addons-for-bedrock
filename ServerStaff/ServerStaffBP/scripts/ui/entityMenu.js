
import { ActionFormData } from "@minecraft/server-ui";
import { Config } from "../config";

export function openEntityMenu(player) {
    const form = new ActionFormData()
        .title("§8Entidades")
        .body("§7Gerenciamento de Lag e Mobs")
        .button("§8Limpar Itens do Chao")
        .button("§8Matar Monstros Hostis")
        .button("§8Matar TODAS Entidades (Exceto Players)");

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        const dim = player.dimension;

        switch(response.selection) {
            case 0: // Itens
                dim.runCommandAsync("kill @e[type=item]");
                player.sendMessage(Config.PREFIX + "Itens removidos.");
                break;
            case 1: // Hostile
                // Lista basica de hostis comuns
                dim.runCommandAsync("kill @e[family=monster]");
                player.sendMessage(Config.PREFIX + "Monstros removidos.");
                break;
            case 2: // All
                dim.runCommandAsync("kill @e[type=!player]");
                player.sendMessage(Config.PREFIX + "Todas entidades removidas.");
                break;
        }
    });
}