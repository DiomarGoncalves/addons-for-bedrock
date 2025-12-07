import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// --- CONSTANTES ---
const ORB_ID = "custom:teleport_orb";
const ELEVATOR_ID = "custom:elevator";
const ELEVATOR_MAX_DIST = 1000;

// ===================== ORBE DE TELEPORTE =====================

// Funções utilitárias do orbe
function getPlayerWarps(player) {
    const data = player.getDynamicProperty("saved_warps");
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function savePlayerWarps(player, warps) {
    player.setDynamicProperty("saved_warps", JSON.stringify(warps));
}

function getDimensionName(dimId) {
    return dimId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();
}

// --- UI do Orbe ---
world.beforeEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack.typeId !== ORB_ID) return;
    const player = ev.source;

    // Executa a UI no próximo tick para sair do contexto do beforeEvent
    system.run(() => {
        showMainMenu(player);
    });
});

function showMainMenu(player) {
    const warps = getPlayerWarps(player);
    const form = new ActionFormData()
        .title("Orbe de Teleporte")
        .body("Selecione um destino ou gerencie seus pontos de teleporte.");

    // Lista os warps salvos
    warps.forEach((warp) => {
        form.button(
            "§" +
                getColorCode(warp.color) +
                warp.name +
                "\n§F" +
                getDimensionName(warp.dimId) +
                ": " +
                Math.floor(warp.x) +
                ", " +
                Math.floor(warp.y) +
                ", " +
                Math.floor(warp.z),
            getIconTexture(warp.icon)
        );
    });

    form.button("§2+ Adicionar novo ponto", "textures/ui/color_plus");

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === warps.length) {
            // Clicou em "Adicionar novo ponto"
            showAddWarpMenu(player);
        } else if (response.selection >= 0 && response.selection < warps.length) {
            showWarpOptions(player, response.selection);
        }
    });
}

function showAddWarpMenu(player) {
    const form = new ModalFormData()
        .title("Salvar Local")
        .textField("Nome do ponto", "Ex: Base, Casa, Mina...", "Casa")
        .dropdown("Cor do nome", ["White", "Green", "Blue", "Yellow", "Purple", "Red"], 1)
        .dropdown("Ícone", ["Star", "House", "Sword", "Portal", "Chest"], 1);

    form.show(player).then((res) => {
        if (res.canceled) return;

        const values = res.formValues;
        const name = values[0];
        const colorIndex = values[1];
        const iconIndex = values[2];

        const colors = ["White", "Green", "Blue", "Yellow", "Purple", "Red"];
        const icons = ["Star", "House", "Sword", "Portal", "Chest"];

        const color = colors[colorIndex] || "White";
        const icon = icons[iconIndex] || "Star";

        const newWarp = {
            id: Date.now().toString(),
            name: String(name || "Ponto"),
            color: color,
            icon: icon,
            x: player.location.x,
            y: player.location.y,
            z: player.location.z,
            dimId: player.dimension.id
        };

        const warps = getPlayerWarps(player);
        warps.push(newWarp);
        savePlayerWarps(player, warps);

        player.sendMessage("§aPonto de teleporte salvo com sucesso!");
    });
}

function showWarpOptions(player, warpIndex) {
    const warps = getPlayerWarps(player);
    const warp = warps[warpIndex];
    if (!warp) return;

    const form = new ActionFormData()
        .title(warp.name)
        .body(
            "Posição: " +
                Math.floor(warp.x) +
                ", " +
                Math.floor(warp.y) +
                ", " +
                Math.floor(warp.z)
        )
        .button("§l§2Teleportar", "textures/ui/portalBg")
        .button("Atualizar posição", "textures/ui/refresh")
        .button("Editar detalhes", "textures/ui/pencil_edit_icon")
        .button("§cExcluir", "textures/ui/trash");

    form.show(player).then((res) => {
        if (res.canceled) return;

        if (res.selection === 0) {
            // Teleportar
            try {
                const targetLoc = { x: warp.x, y: warp.y, z: warp.z };
                if (warp.dimId !== player.dimension.id) {
                    const targetDim = world.getDimension(warp.dimId);
                    player.teleport(targetLoc, { dimension: targetDim });
                } else {
                    player.teleport(targetLoc);
                }

                player.playSound("mob.endermen.portal");
                try {
                    player.runCommandAsync("particle minecraft:ender_explosion_emitter ~ ~ ~");
                } catch (e) {}
            } catch (e) {
                player.sendMessage(
                    "§cErro: não foi possível teleportar. A dimensão pode estar descarregada."
                );
            }
        } else if (res.selection === 1) {
            // Atualizar posição
            warp.x = player.location.x;
            warp.y = player.location.y;
            warp.z = player.location.z;
            warp.dimId = player.dimension.id;
            savePlayerWarps(player, warps);
            player.sendMessage("§ePosição do ponto atualizada.");
        } else if (res.selection === 2) {
            // Editar detalhes
            showEditWarpMenu(player, warpIndex);
        } else if (res.selection === 3) {
            // Excluir
            warps.splice(warpIndex, 1);
            savePlayerWarps(player, warps);
            player.sendMessage("§cPonto de teleporte excluído.");
        }
    });
}

function showEditWarpMenu(player, index) {
    const warps = getPlayerWarps(player);
    const warp = warps[index];
    if (!warp) return;

    const colors = ["White", "Green", "Blue", "Yellow", "Purple", "Red"];
    const icons = ["Star", "House", "Sword", "Portal", "Chest"];

    const colorIndex = Math.max(0, colors.indexOf(warp.color));
    const iconIndex = Math.max(0, icons.indexOf(warp.icon));

    const form = new ModalFormData()
        .title("Editar Ponto")
        .textField("Nome", "Nome do ponto", warp.name)
        .dropdown("Cor do nome", colors, colorIndex)
        .dropdown("Ícone", icons, iconIndex);

    form.show(player).then((res) => {
        if (res.canceled) return;

        const values = res.formValues;
        const name = values[0];
        const cIdx = values[1];
        const iIdx = values[2];

        warp.name = String(name || warp.name);
        warp.color = colors[cIdx] || warp.color;
        warp.icon = icons[iIdx] || warp.icon;

        savePlayerWarps(player, warps);
        player.sendMessage("§aPonto de teleporte atualizado.");
    });
}

// Helpers (cores e ícones)
function getColorCode(colorName) {
    const map = {
        White: "f",
        Green: "a",
        Blue: "b",
        Yellow: "e",
        Purple: "d",
        Red: "c"
    };
    return map[colorName] || "f";
}

function getIconTexture(iconName) {
    const map = {
        Star: "textures/items/nether_star",
        House: "textures/items/bed_red",
        Sword: "textures/items/diamond_sword",
        Portal: "textures/ui/portalBg",
        Chest: "textures/blocks/chest_front"
    };
    return map[iconName] || "textures/items/ender_pearl";
}

// ===================== ELEVADOR =====================

// Lógica do elevador (subir e descer no mesmo loop)
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            if (!player.isValid()) continue;

            // cooldown de teleporte
            if (player.hasTag("elevator_cd")) continue;

            const dim = player.dimension;
            const loc = player.location;

            const x = Math.floor(loc.x);
            const y = Math.floor(loc.y);
            const z = Math.floor(loc.z);

            // Alturas seguras do mundo
            const minY =
                typeof dim.getMinHeight === "function" ? dim.getMinHeight() : -64;
            const maxY =
                typeof dim.getMaxHeight === "function" ? dim.getMaxHeight() - 1 : 319;

            // bloco diretamente embaixo do player
            const baseY = Math.floor(y - 1);
            if (baseY < minY || baseY > maxY) continue;

            const blockUnder = dim.getBlock({ x: x, y: baseY, z: z });

            // Precisa estar em cima de um elevador
            if (!blockUnder || blockUnder.typeId !== ELEVATOR_ID) continue;

            const vel = player.getVelocity();

            // ============ DESCER (agachando) ============
            if (player.isSneaking) {
                let targetY = null;

                for (let dist = 1; dist <= ELEVATOR_MAX_DIST; dist++) {
                    const checkY = baseY - dist;
                    if (checkY < minY) break;

                    const block = dim.getBlock({ x: x, y: checkY, z: z });
                    if (block && block.typeId === ELEVATOR_ID) {
                        targetY = checkY + 1;
                        break;
                    }
                }

                if (targetY !== null) {
                    teleportPlayer(player, targetY, x, z);
                }

                // se está agachando, não tenta subir no mesmo tick
                continue;
            }

            // ============ SUBIR (pulando) ============
            if (vel.y > 0.05) {
                let targetY = null;

                for (let dist = 1; dist <= ELEVATOR_MAX_DIST; dist++) {
                    const checkY = baseY + dist;
                    if (checkY > maxY) break;

                    const block = dim.getBlock({ x: x, y: checkY, z: z });
                    if (block && block.typeId === ELEVATOR_ID) {
                        targetY = checkY + 1;
                        break;
                    }
                }

                if (targetY !== null) {
                    teleportPlayer(player, targetY, x, z);
                }
            }
        } catch (e) {
            console.warn("Erro no elevador:", e);
        }
    }
}, 2);

function teleportPlayer(player, targetY, blockX, blockZ) {
    const targetLoc = { x: blockX + 0.5, y: targetY, z: blockZ + 0.5 };

    player.teleport(targetLoc);
    player.playSound("random.orb", { pitch: 1.0, volume: 0.5 });

    try {
        player.runCommandAsync("particle minecraft:villager_happy ~ ~ ~");
    } catch (e) {}

    // cooldown pra não teleportar duas vezes seguidas sem querer
    player.addTag("elevator_cd");
    system.runTimeout(() => {
        if (player.isValid()) player.removeTag("elevator_cd");
    }, 15); // 0,75s
}

console.warn("Addon carregado: Sistema de Orbe de Teleporte e Elevador ativo.");
