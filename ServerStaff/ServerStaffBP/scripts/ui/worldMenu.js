
import { ActionFormData } from "@minecraft/server-ui";
import { Config } from "../config";

export function openWorldMenu(player) {
    const form = new ActionFormData()
        .title("§8Mundo")
        .body("§7Controle de Tempo e Clima")
        .button("§8Sol (Clear)")
        .button("§8Chuva")
        .button("§8Tempestade")
        .button("§8Amanhecer")
        .button("§8Dia (Meio-dia)")
        .button("§8Por do Sol")
        .button("§8Noite");

    form.show(player).then((response) => {
        if (response.canceled) return;
        
        const dim = player.dimension;

        switch(response.selection) {
            case 0: dim.runCommandAsync("weather clear"); break;
            case 1: dim.runCommandAsync("weather rain"); break;
            case 2: dim.runCommandAsync("weather thunder"); break;
            case 3: dim.runCommandAsync("time set sunrise"); break;
            case 4: dim.runCommandAsync("time set day"); break;
            case 5: dim.runCommandAsync("time set sunset"); break;
            case 6: dim.runCommandAsync("time set night"); break;
        }

        player.sendMessage(Config.PREFIX + "Mundo atualizado.");
    });
}