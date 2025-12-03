import { world, system } from "@minecraft/server";
import { Config } from "../config";

// Função exportada para ser usada no ServerTools também
export function buildJailStructure() {
    const dim = world.getDimension("overworld");

    // Sequência de construção para evitar sufocamento imediato
    // Passo 1: Cubo Sólido
    dim.runCommandAsync("fill 1 150 1 -1 154 -1 bedrock").then(() => {
        // Passo 2: Oco por dentro
        // Pequeno delay para garantir processamento
        system.runTimeout(() => {
            dim.runCommandAsync("fill 1 152 1 -1 152 -1 air");
            dim.runCommandAsync("fill 0 151 0 0 151 0 air"); // Ponto central
        }, 5);
    }).catch(e => console.warn("Erro ao construir jaula: " + e));
}

// Loop de verificação
system.runInterval(() => {
    const players = world.getAllPlayers();
    const jailDim = world.getDimension("overworld");

    for (const player of players) {
        if (player.hasTag(Config.JAIL_TAG)) {
            const { x, y, z } = Config.JAIL_COORDINATES;
            
            const dist = Math.sqrt(
                Math.pow(player.location.x - x, 2) +
                Math.pow(player.location.y - y, 2) +
                Math.pow(player.location.z - z, 2)
            );

            // Raio de segurança (3 blocos)
            if (dist > 3 || player.dimension.id !== jailDim.id) {
                player.teleport({ x: 0.5, y: 151, z: 0.5 }, { dimension: jailDim });
                player.sendMessage("§8» §7Voce esta preso.");
            }
            
            player.runCommandAsync("gamemode adventure @s");
        }
    }
}, 20);