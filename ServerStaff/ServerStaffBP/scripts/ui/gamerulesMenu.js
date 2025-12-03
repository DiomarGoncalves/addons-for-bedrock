
import { ModalFormData } from "@minecraft/server-ui";
import { Config } from "../config";

export function openGameRulesMenu(player) {
    const rules = [
        { id: "pvp", label: "PVP" },
        { id: "keepinventory", label: "Manter Inventario" },
        { id: "mobgriefing", label: "Mob Griefing" },
        { id: "drowningdamage", label: "Dano de Afogamento" },
        { id: "falldamage", label: "Dano de Queda" },
        { id: "showcoordinates", label: "Mostrar Coordenadas" },
        { id: "tntexplodes", label: "TNT Explode" },
        { id: "dodaylightcycle", label: "Ciclo de Dia" },
        { id: "doweathercycle", label: "Ciclo de Clima" }
    ];

    const form = new ModalFormData()
        .title("§8GameRules")
        .toggle("§7PVP", true)
        .toggle("§7Manter Itens (KeepInv)", false)
        .toggle("§7Mob Griefing (Creeper)", true)
        .toggle("§7Dano Afogamento", true)
        .toggle("§7Dano Queda", true)
        .toggle("§7Coords", false)
        .toggle("§7TNT Explode", true)
        .toggle("§7Ciclo Dia", true)
        .toggle("§7Ciclo Clima", true);

    form.show(player).then((response) => {
        if (response.canceled) return;

        const values = response.formValues;
        
        values.forEach((val, index) => {
            const ruleId = rules[index].id;
            const ruleVal = val;
            
            player.runCommandAsync(`gamerule ${ruleId} ${ruleVal}`);
        });

        player.sendMessage(Config.PREFIX + "Regras atualizadas.");
    });
}