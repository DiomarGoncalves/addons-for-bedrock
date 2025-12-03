import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Config } from "../config";
import { openPlayerMenu } from "./playerMenu";
import { openServerTools } from "./serverTools";

export function openMainMenu(player) {
    const players = world.getAllPlayers();
    const form = new ActionFormData()
        .title("§8Gerenciamento Staff")
        .body(`§7Administrador: §f${player.name}\n§7Online: §f${players.length}`)
        .button("§l§8[ §fCONFIG SERVER §8]", "textures/ui/gear");

    players.forEach((p) => {
        let status = "§7Normal";
        if (p.hasTag(Config.BAN_TAG)) status = "§fBANIDO";
        else if (p.hasTag(Config.JAIL_TAG)) status = "§fPRESO";
        else if (p.hasTag(Config.FREEZE_TAG)) status = "§fCONGELADO";
        else if (p.hasTag(Config.STAFF_TAG)) status = "§fSTAFF";
        
        form.button(`${p.name}\n${status}`, "textures/ui/icon_steve");
    });

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === 0) {
            openServerTools(player);
            return;
        }

        const selectedPlayer = players[response.selection - 1];
        if (selectedPlayer) {
            openPlayerMenu(player, selectedPlayer);
        }
    });
}