import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// --- CONSTANTES ---
const ORB_ID = "custom:teleport_orb";
const ELEVATOR_ID = "custom:elevator";
const ELEVATOR_MAX_DIST = 1000;

// --- LÓGICA DO ORBE DE TELEPORTE ---

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
            `§${getColorCode(warp.color)}${warp.name}\n§F${getDimensionName(warp.dimId)}: ${Math.floor(warp.x)}, ${Math.floor(warp.y)}, ${Math.floor(warp.z)}`,
            getIconTexture(warp.icon)
        );
    });

    form.button("§2+ Adicionar novo ponto", "textures/ui/color_plus");

    form.show(player).then((response) => {
        if (response.canceled) return;

        // Se clicou em "Adicionar novo ponto" (último botão)
        if (response.selection === warps.length) {
            showAddWarpMenu(player);
        } else {
            // Clicou em um warp existente
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

        const [name, colorIndex, iconIndex] = res.formValues;
        const color = ["White", "Green", "Blue", "Yellow", "Purple", "Red"][colorIndex];
        const icon = ["Star", "House", "Sword", "Portal", "Chest"][iconIndex];

        const newWarp = {
            id: Date.now().toString(),
            name: name,
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

    const form = new ActionFormData()
        .title(warp.name)
        .body(`Posição: ${Math.floor(warp.x)}, ${Math.floor(warp.y)}, ${Math.floor(warp.z)}`)
        .button("§l§2Teleportar", "textures/ui/portalBg")
        .button("Atualizar posição", "textures/ui/refresh")
        .button("Editar detalhes", "textures/ui/pencil_edit_icon")
        .button("§cExcluir", "textures/ui/trash");

    form.show(player).then((res) => {
        if (res.canceled) return;

        if (res.selection === 0) {
            // Teleportar
            try {
                if (warp.dimId !== player.dimension.id) {
                    // Teleporte entre dimensões
                    player.teleport(
                        { x: warp.x, y: warp.y, z: warp.z },
                        { dimension: world.getDimension(warp.dimId) }
                    );
                } else {
                    player.teleport({ x: warp.x, y: warp.y, z: warp.z });
                }
                player.playSound("mob.endermen.portal");
                player.runCommand("particle minecraft:ender_explosion_emitter ~ ~ ~");
            } catch (e) {
                player.sendMessage("§cErro: não foi possível teleportar. A dimensão pode estar descarregada.");
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

    const colors = ["White", "Green", "Blue", "Yellow", "Purple", "Red"];
    const icons = ["Star", "House", "Sword", "Portal", "Chest"];

    const form = new ModalFormData()
        .title("Editar Ponto")
        .textField("Nome", "Nome do ponto", warp.name)
        .dropdown("Cor do nome", colors, Math.max(0, colors.indexOf(warp.color)))
        .dropdown("Ícone", icons, Math.max(0, icons.indexOf(warp.icon)));

    form.show(player).then((res) => {
        if (res.canceled) return;
        const [name, cIdx, iIdx] = res.formValues;

        warp.name = name;
        warp.color = colors[cIdx];
        warp.icon = icons[iIdx];

        savePlayerWarps(player, warps);
        player.sendMessage("§aPonto de teleporte atualizado.");
    });
}

// Helpers (cores e ícones)
function getColorCode(colorName) {
    const map = {
        "White": "f",
        "Green": "a",
        "Blue": "b",
        "Yellow": "e",
        "Purple": "d",
        "Red": "c"
    };
    return map[colorName] || "f";
}

function getIconTexture(iconName) {
    const map = {
        "Star": "textures/items/nether_star",
        "House": "textures/items/bed_red",
        "Sword": "textures/items/diamond_sword",
        "Portal": "textures/ui/portalBg",
        "Chest": "textures/blocks/chest_front"
    };
    return map[iconName];
}

// ========= Função pra checar espaço em cima do elevador =========
function hasSafeHeadroom(dim, x, elevatorY, z) {
    const head1 = dim.getBlock({ x, y: elevatorY + 1, z });
    const head2 = dim.getBlock({ x, y: elevatorY + 2, z });

    const isAir = (b) => !b || b.typeId === "minecraft:air";

    // Só é seguro se os dois blocos acima forem ar
    return isAir(head1) && isAir(head2);
}

// --- LÓGICA DO ELEVADOR ---

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            // cooldown de teleporte
            if (player.hasTag("elevator_cd")) continue;

            const dim = player.dimension;
            const loc = player.location;

            const x = Math.floor(loc.x);
            const y = Math.floor(loc.y);
            const z = Math.floor(loc.z);

            const blockUnder = dim.getBlock({ x: x, y: y - 1, z: z });

            // Precisa estar em cima de um elevador
            if (!blockUnder || blockUnder.typeId !== ELEVATOR_ID) continue;

            // --- DESCER (agachando / sneak) ---
            if (player.isSneaking) {
                let targetY = -999;

                // Procura elevador para baixo até o limite configurado
                for (let i = 2; i <= ELEVATOR_MAX_DIST; i++) {
                    const checkY = y - i;

                    // limite inferior do mundo
                    if (checkY < dim.getMinHeight()) break;

                    const block = dim.getBlock({ x: x, y: checkY, z: z });

                    if (block && block.typeId === ELEVATOR_ID) {
                        if (hasSafeHeadroom(dim, x, checkY, z)) {
                            targetY = checkY + 1; // posição em cima do elevador
                            break;
                        }
                    }
                }

                if (targetY !== -999) {
                    teleportPlayer(player, targetY, x, z);
                }
            }

            // --- SUBIR (pulando) ---
            else {
                const vel = player.getVelocity();
                if (vel.y > 0.05) {
                    let targetY = -999;

                    // Procura elevador para cima até o limite configurado
                    for (let i = 1; i <= ELEVATOR_MAX_DIST; i++) {
                        const checkY = y + i;

                        // limite superior (ajusta se usar altura custom)
                        if (checkY > 320) break;

                        const block = dim.getBlock({ x: x, y: checkY, z: z });

                        if (block && block.typeId === ELEVATOR_ID) {
                            if (hasSafeHeadroom(dim, x, checkY, z)) {
                                targetY = checkY + 1;
                                break;
                            }
                        }
                    }

                    if (targetY !== -999) {
                        teleportPlayer(player, targetY, x, z);
                    }
                }
            }
        } catch (e) {
            // Se quiser debugar, descomenta:
            // console.warn("Erro no elevador:", e);
        }
    }
}, 2);

function teleportPlayer(player, targetY, blockX, blockZ) {
    const targetLoc = { x: blockX + 0.5, y: targetY, z: blockZ + 0.5 };

    player.teleport(targetLoc);
    player.playSound("random.orb", { pitch: 1.0, volume: 0.5 });

    try {
        player.runCommandAsync("particle minecraft:villager_happy ~ ~ ~");
    } catch (e) { }

    // cooldown pra não teleportar duas vezes seguidas sem querer
    player.addTag("elevator_cd");
    system.runTimeout(() => {
        if (player.isValid()) player.removeTag("elevator_cd");
    }, 15); // 0,75s
}

console.warn("Addon carregado: Sistema de Orbe de Teleporte e Elevador ativo.");
