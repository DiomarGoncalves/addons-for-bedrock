import { world, system, Player, ItemStack, BlockPermutation } from '@minecraft/server';

// Sistema de Varinha com Partícula Única na Direção do Olhar
class SingleParticleWand {
    constructor() {
        this.playerCooldowns = new Map();
        this.playerRanges = new Map();
        this.initialize();
    }

    initialize() {
        try {
            world.sendMessage("§e[Single Wand] Iniciando sistema de partícula única...");
            
            system.runTimeout(() => {
                this.setupEvents();
                this.startDirectionDetection();
                world.sendMessage("§a[Single Wand] Sistema ativo! Segure graveto e olhe para faces de blocos!");
                world.sendMessage("§8Uma partícula aparece na direção que você olha | Clique direito para construir");
            }, 20);
            
        } catch (error) {
            world.sendMessage(`§c[Single Wand] Erro: ${error}`);
        }
    }

    setupEvents() {
        try {
            // Evento de clique direito - construir na direção atual
            if (world.afterEvents && world.afterEvents.itemUse) {
                world.afterEvents.itemUse.subscribe((event) => {
                    try {
                        const { source: player, itemStack } = event;
                        
                        if (!player || !itemStack || itemStack.typeId !== 'minecraft:stick') return;
                        
                        // Detectar direção atual que está olhando
                        const currentDirection = this.getCurrentDirection(player);
                        if (currentDirection) {
                            this.buildInDirection(player, currentDirection);
                        } else {
                            player.sendMessage("§c❌ Mire em um bloco para construir!");
                        }
                        
                    } catch (error) {
                        world.sendMessage(`§c[Single Wand] Erro no clique: ${error}`);
                    }
                });
            }

            // Comandos
            if (world.beforeEvents && world.beforeEvents.chatSend) {
                world.beforeEvents.chatSend.subscribe((event) => {
                    try {
                        const message = event.message.toLowerCase();
                        
                        if (message === "!wand-help") {
                            event.cancel = true;
                            this.showHelp(event.sender);
                        }
                        
                        if (message.startsWith("!range ")) {
                            event.cancel = true;
                            const rangeStr = message.split(" ")[1];
                            const range = parseInt(rangeStr);
                            
                            if (isNaN(range) || range < 1 || range > 20) {
                                event.sender.sendMessage("§c❌ Use valores entre 1 e 20!");
                                return;
                            }
                            
                            this.playerRanges.set(event.sender.name, range);
                            event.sender.sendMessage(`§a✅ Distância: §e${range} blocos§a!`);
                        }
                        
                    } catch (error) {
                        world.sendMessage(`§c[Single Wand] Erro no comando: ${error}`);
                    }
                });
            }

        } catch (error) {
            world.sendMessage(`§c[Single Wand] Erro ao configurar eventos: ${error}`);
        }
    }

    // Sistema principal - detectar direção que o jogador está olhando
    startDirectionDetection() {
        system.runInterval(() => {
            try {
                for (const player of world.getPlayers()) {
                    if (!player.isValid()) continue;
                    
                    // Verificar se está segurando graveto
                    const heldItem = player.getComponent('minecraft:equippable')?.getEquipment('Mainhand');
                    if (!heldItem || heldItem.typeId !== 'minecraft:stick') {
                        continue;
                    }
                    
                    // Mostrar partícula na direção atual
                    this.showCurrentDirectionParticle(player);
                }
            } catch (error) {
                // Silencioso para não spammar
            }
        }, 2); // Verificar mais frequentemente para suavidade
    }

    showCurrentDirectionParticle(player) {
        try {
            // Detectar bloco e face que está olhando
            const blockRaycast = player.getBlockFromViewDirection({ maxDistance: 6 });
            if (!blockRaycast || !blockRaycast.block) return;

            const block = blockRaycast.block;
            const face = blockRaycast.face;
            
            // Calcular direção baseada na face e posição do olhar
            const direction = this.calculateDirectionFromLook(player, block, face);
            if (!direction) return;

            // Mostrar partícula na posição calculada
            const particlePos = this.getParticlePosition(block.location, face, direction);
            
            // Usar múltiplas partículas para melhor visibilidade
            player.dimension.spawnParticle('minecraft:villager_happy', {
                x: particlePos.x,
                y: particlePos.y + 0.8,
                z: particlePos.z
            });
            
        } catch (error) {
            // Ignorar erros de partículas
        }
    }

    calculateDirectionFromLook(player, block, face) {
        try {
            // Obter direção do olhar do jogador
            const viewDirection = player.getViewDirection();
            const blockCenter = {
                x: block.location.x + 0.5,
                y: block.location.y + 0.5,
                z: block.location.z + 0.5
            };
            
            // Calcular onde o olhar intersecta com a face do bloco
            const intersection = this.calculateFaceIntersection(player.location, viewDirection, blockCenter, face);
            if (!intersection) return null;

            // Converter posição na face para direção de construção
            return this.facePositionToDirection(intersection, face);
            
        } catch (error) {
            return null;
        }
    }

    calculateFaceIntersection(playerPos, viewDir, blockCenter, face) {
        // Calcular onde o raio do olhar intersecta com a face do bloco
        const faceNormal = this.getFaceNormal(face);
        const faceCenter = {
            x: blockCenter.x + faceNormal.x * 0.5,
            y: blockCenter.y + faceNormal.y * 0.5,
            z: blockCenter.z + faceNormal.z * 0.5
        };

        // Calcular interseção do raio com o plano da face
        const eyePos = {
            x: playerPos.x,
            y: playerPos.y + 1.6, // Altura dos olhos
            z: playerPos.z
        };

        // Produto escalar para encontrar interseção
        const denominator = 
            viewDir.x * faceNormal.x + 
            viewDir.y * faceNormal.y + 
            viewDir.z * faceNormal.z;

        if (Math.abs(denominator) < 0.0001) return null; // Paralelo à face

        const t = (
            (faceCenter.x - eyePos.x) * faceNormal.x +
            (faceCenter.y - eyePos.y) * faceNormal.y +
            (faceCenter.z - eyePos.z) * faceNormal.z
        ) / denominator;

        if (t < 0) return null; // Atrás do jogador

        // Ponto de interseção
        const intersection = {
            x: eyePos.x + viewDir.x * t,
            y: eyePos.y + viewDir.y * t,
            z: eyePos.z + viewDir.z * t
        };

        return intersection;
    }

    getFaceNormal(face) {
        const normals = {
            'North': { x: 0, y: 0, z: -1 },
            'South': { x: 0, y: 0, z: 1 },
            'East': { x: 1, y: 0, z: 0 },
            'West': { x: -1, y: 0, z: 0 },
            'Up': { x: 0, y: 1, z: 0 },
            'Down': { x: 0, y: -1, z: 0 }
        };
        return normals[face] || { x: 0, y: 0, z: 0 };
    }

    facePositionToDirection(intersection, face) {
        // SIMPLIFICADO: Usar apenas a direção perpendicular à face
        // Isso evita construções diagonais/escadinha indesejadas
        switch (face) {
            case 'North':
                return { x: 0, y: 0, z: -1, name: '⬆ Norte' };
            case 'South':
                return { x: 0, y: 0, z: 1, name: '⬇ Sul' };
            case 'East':
                return { x: 1, y: 0, z: 0, name: '➡ Leste' };
            case 'West':
                return { x: -1, y: 0, z: 0, name: '⬅ Oeste' };
            case 'Up':
                return { x: 0, y: 1, z: 0, name: '⬆ Cima' };
            case 'Down':
                return { x: 0, y: 0, z: 0, name: '🔽 Baixo (Horizontal)' };
            default:
                return null;
        }
    }

    getDirectionFromFacePosition(u, v, faceType) {
        // Dividir a face em 9 regiões (3x3)
        const regionU = u < 0.33 ? 0 : (u < 0.67 ? 1 : 2);
        const regionV = v < 0.33 ? 0 : (v < 0.67 ? 1 : 2);
        
        // Mapear região para direção baseada no tipo de face
        const directionMap = {
            'north': [
                [{ x: -1, y: -1, z: -1, name: '↙ Sudoeste-Baixo' }, { x: 0, y: -1, z: -1, name: '⬇ Sul-Baixo' }, { x: 1, y: -1, z: -1, name: '↘ Sudeste-Baixo' }],
                [{ x: -1, y: 0, z: -1, name: '⬅ Oeste' }, { x: 0, y: 0, z: -1, name: '⬆ Norte' }, { x: 1, y: 0, z: -1, name: '➡ Leste' }],
                [{ x: -1, y: 1, z: -1, name: '↖ Noroeste-Cima' }, { x: 0, y: 1, z: -1, name: '⬆ Norte-Cima' }, { x: 1, y: 1, z: -1, name: '↗ Nordeste-Cima' }]
            ],
            'south': [
                [{ x: 1, y: -1, z: 1, name: '↙ Sudoeste-Baixo' }, { x: 0, y: -1, z: 1, name: '⬇ Sul-Baixo' }, { x: -1, y: -1, z: 1, name: '↘ Sudeste-Baixo' }],
                [{ x: 1, y: 0, z: 1, name: '⬅ Oeste' }, { x: 0, y: 0, z: 1, name: '⬇ Sul' }, { x: -1, y: 0, z: 1, name: '➡ Leste' }],
                [{ x: 1, y: 1, z: 1, name: '↖ Noroeste-Cima' }, { x: 0, y: 1, z: 1, name: '⬆ Sul-Cima' }, { x: -1, y: 1, z: 1, name: '↗ Nordeste-Cima' }]
            ],
            'east': [
                [{ x: 1, y: -1, z: 1, name: '↙ Sul-Baixo' }, { x: 1, y: -1, z: 0, name: '⬇ Baixo' }, { x: 1, y: -1, z: -1, name: '↘ Norte-Baixo' }],
                [{ x: 1, y: 0, z: 1, name: '⬅ Sul' }, { x: 1, y: 0, z: 0, name: '➡ Leste' }, { x: 1, y: 0, z: -1, name: '➡ Norte' }],
                [{ x: 1, y: 1, z: 1, name: '↖ Sul-Cima' }, { x: 1, y: 1, z: 0, name: '⬆ Cima' }, { x: 1, y: 1, z: -1, name: '↗ Norte-Cima' }]
            ],
            'west': [
                [{ x: -1, y: -1, z: -1, name: '↙ Sul-Baixo' }, { x: -1, y: -1, z: 0, name: '⬇ Baixo' }, { x: -1, y: -1, z: 1, name: '↘ Norte-Baixo' }],
                [{ x: -1, y: 0, z: -1, name: '⬅ Sul' }, { x: -1, y: 0, z: 0, name: '⬅ Oeste' }, { x: -1, y: 0, z: 1, name: '➡ Norte' }],
                [{ x: -1, y: 1, z: -1, name: '↖ Sul-Cima' }, { x: -1, y: 1, z: 0, name: '⬆ Cima' }, { x: -1, y: 1, z: 1, name: '↗ Norte-Cima' }]
            ],
            'up': [
                [{ x: -1, y: 1, z: 1, name: '↙ Sudoeste' }, { x: 0, y: 1, z: 1, name: '⬇ Sul' }, { x: 1, y: 1, z: 1, name: '↘ Sudeste' }],
                [{ x: -1, y: 1, z: 0, name: '⬅ Oeste' }, { x: 0, y: 1, z: 0, name: '⬆ Cima' }, { x: 1, y: 1, z: 0, name: '➡ Leste' }],
                [{ x: -1, y: 1, z: -1, name: '↖ Noroeste' }, { x: 0, y: 1, z: -1, name: '⬆ Norte' }, { x: 1, y: 1, z: -1, name: '↗ Nordeste' }]
            ],
            'down': [
                [{ x: -1, y: -1, z: -1, name: '↙ Noroeste' }, { x: 0, y: -1, z: -1, name: '⬆ Norte' }, { x: 1, y: -1, z: -1, name: '↗ Nordeste' }],
                [{ x: -1, y: -1, z: 0, name: '⬅ Oeste' }, { x: 0, y: -1, z: 0, name: '⬇ Baixo' }, { x: 1, y: -1, z: 0, name: '➡ Leste' }],
                [{ x: -1, y: -1, z: 1, name: '↖ Sudoeste' }, { x: 0, y: -1, z: 1, name: '⬇ Sul' }, { x: 1, y: -1, z: 1, name: '↘ Sudeste' }]
            ]
        };

        return directionMap[faceType]?.[regionV]?.[regionU] || null;
    }

    getParticlePosition(blockLocation, face, direction) {
        // Posição base da face
        const faceOffset = this.getFaceOffset(face);
        const basePos = {
            x: blockLocation.x + 0.5 + faceOffset.x,
            y: blockLocation.y + 0.5 + faceOffset.y,
            z: blockLocation.z + 0.5 + faceOffset.z
        };

        // Offset adicional baseado na direção (para mostrar onde vai construir)
        const directionOffset = 0.2;
        
        return {
            x: basePos.x + (direction.x * directionOffset * 0.3),
            y: basePos.y + (direction.y * directionOffset * 0.3),
            z: basePos.z + (direction.z * directionOffset * 0.3)
        };
    }

    getFaceOffset(face) {
        // Offset para colar a partícula na face
        const offset = 0.05;
        const offsets = {
            'North': { x: 0, y: 0, z: -offset },
            'South': { x: 0, y: 0, z: offset },
            'East': { x: offset, y: 0, z: 0 },
            'West': { x: -offset, y: 0, z: 0 },
            'Up': { x: 0, y: offset, z: 0 },
            'Down': { x: 0, y: -offset, z: 0 }
        };
        return offsets[face] || { x: 0, y: 0, z: 0 };
    }

    getCurrentDirection(player) {
        try {
            const blockRaycast = player.getBlockFromViewDirection({ maxDistance: 6 });
            if (!blockRaycast || !blockRaycast.block) return null;

            const block = blockRaycast.block;
            const face = blockRaycast.face;
            
            return this.calculateDirectionFromLook(player, block, face);
        } catch (error) {
            return null;
        }
    }

    buildInDirection(player, direction) {
        try {
            // Verificar cooldown
            const now = Date.now();
            const lastUse = this.playerCooldowns.get(player.name) || 0;
            if (now - lastUse < 500) return;
            
            this.playerCooldowns.set(player.name, now);
            
            const range = this.playerRanges.get(player.name) || 5;
            const buildBlock = this.getBuildBlock(player);
            
            if (!buildBlock) {
                player.sendMessage("§c❌ Você precisa ter blocos no inventário!");
                return;
            }

            // Obter bloco base
            const blockRaycast = player.getBlockFromViewDirection({ maxDistance: 6 });
            if (!blockRaycast || !blockRaycast.block) {
                player.sendMessage("§c❌ Aponte para um bloco válido para construir!");
                return;
            }

            const face = blockRaycast.face;
            
            // 🔧 CORREÇÃO: Se estiver olhando para baixo, anula construção vertical
            if (face === 'Down') {
                direction.y = 0;
                world.sendMessage(`§8[DEBUG] Face Down detectada - forçando Y=0`);
            }
            world.sendMessage(`§e[DEBUG] Construindo na direção: ${direction.name}`);
            // Debug melhorado
            world.sendMessage(`§e[DEBUG] Face detectada: ${face}`);
            world.sendMessage(`§8[DEBUG] Direção original: (${direction.x}, ${direction.y}, ${direction.z}) - ${direction.name}`);
            
            // Construir blocos
            const blocksPlaced = this.buildBlocks(player, blockRaycast.block.location, direction, buildBlock, range);
            
            if (blocksPlaced > 0) {
                player.sendMessage(`§a✅ ${blocksPlaced} blocos colocados na direção ${direction.name}!`);
                this.consumeBlocks(player, buildBlock, blocksPlaced);
            } else {
                player.sendMessage("§c❌ Nenhum bloco foi colocado! Verifique se há espaço livre.");
            }
            
        } catch (error) {
            world.sendMessage(`§c[Single Wand] Erro na construção: ${error}`);
        }
    }

    buildBlocks(player, startLocation, direction, blockType, range) {
        let blocksPlaced = 0;
        
        // Debug da construção
        world.sendMessage(`§e[DEBUG] Iniciando construção:`);
        world.sendMessage(`§8- Posição inicial: (${startLocation.x}, ${startLocation.y}, ${startLocation.z})`);
        world.sendMessage(`§8- Direção: (${direction.x}, ${direction.y}, ${direction.z})`);
        world.sendMessage(`§8- Alcance: ${range} blocos`);
        
        for (let i = 1; i <= range; i++) {
            // CORREÇÃO: Construir em linha reta, não em escadinha
            const buildPos = {
                x: Math.floor(startLocation.x + (direction.x * i)),
                y: Math.floor(startLocation.y + (direction.y * i)),
                z: Math.floor(startLocation.z + (direction.z * i))
            };
            
            world.sendMessage(`§8[DEBUG] Bloco ${i}: tentando posição (${buildPos.x}, ${buildPos.y}, ${buildPos.z})`);
            
            try {
                const buildBlock = player.dimension.getBlock(buildPos);
                if (!buildBlock) {
                    world.sendMessage(`§c[DEBUG] Bloco ${i}: posição inválida`);
                    continue;
                }
                
                // Verificar se o espaço está livre
                if (buildBlock.typeId !== 'minecraft:air') {
                    world.sendMessage(`§c[DEBUG] Bloco ${i}: espaço ocupado por ${buildBlock.typeId}`);
                    continue;
                }
                
                // Colocar bloco
                buildBlock.setPermutation(BlockPermutation.resolve(blockType));
                blocksPlaced++;
                world.sendMessage(`§a[DEBUG] Bloco ${i}: colocado com sucesso!`);
                
                // Partícula de sucesso
                const particlePos = {
                    x: buildPos.x + 0.5,
                    y: buildPos.y + 0.5,
                    z: buildPos.z + 0.5
                };
                player.dimension.spawnParticle('minecraft:villager_happy', particlePos);
                
            } catch (error) {
                world.sendMessage(`§c[DEBUG] Erro no bloco ${i} na posição (${buildPos.x}, ${buildPos.y}, ${buildPos.z}): ${error}`);
            }
        }
        
        world.sendMessage(`§e[DEBUG] Construção finalizada: ${blocksPlaced} blocos colocados`);
        return blocksPlaced;
    }

    getBuildBlock(player) {
        try {
            const inventory = player.getComponent('minecraft:inventory');
            if (!inventory) return null;
            
            const container = inventory.container;
            if (!container) return null;
            
            for (let i = 0; i < container.size; i++) {
                try {
                    const item = container.getItem(i);
                    if (item && item.typeId !== 'minecraft:stick' && this.isPlaceableBlock(item.typeId)) {
                        world.sendMessage(`§a[DEBUG] Bloco encontrado: ${item.typeId} (quantidade: ${item.amount})`);
                        return item.typeId;
                    }
                } catch (error) {
                    // Ignorar slots com erro
                    continue;
                }
            }
            
            world.sendMessage(`§c[DEBUG] Nenhum bloco válido encontrado no inventário`);
            return null;
        } catch (error) {
            world.sendMessage(`§c[DEBUG] Erro ao acessar inventário: ${error}`);
            return null;
        }
    }

    consumeBlocks(player, blockType, amount) {
        try {
            const inventory = player.getComponent('minecraft:inventory');
            if (!inventory) {
                world.sendMessage(`§c[DEBUG] Inventário não encontrado`);
                return;
            }
            
            const container = inventory.container;
            if (!container) {
                world.sendMessage(`§c[DEBUG] Container não encontrado`);
                return;
            }
            
            let remaining = amount;
            let consumed = 0;
            
            for (let i = 0; i < container.size && remaining > 0; i++) {
                try {
                    const item = container.getItem(i);
                    if (item && item.typeId === blockType) {
                        const consumeAmount = Math.min(remaining, item.amount);
                        remaining -= consumeAmount;
                        consumed += consumeAmount;
                        
                        if (consumeAmount >= item.amount) {
                            container.setItem(i, undefined);
                        } else {
                            const newItem = item.clone();
                            newItem.amount -= consumeAmount;
                            container.setItem(i, newItem);
                        }
                    }
                } catch (error) {
                    // Ignorar slots com erro
                    continue;
                }
            }
            
            world.sendMessage(`§a[DEBUG] Consumidos ${consumed} blocos do tipo ${blockType}`);
        } catch (error) {
            world.sendMessage(`§c[Single Wand] Erro ao consumir blocos: ${error}`);
        }
    }

    isPlaceableBlock(itemType) {
        const placeableBlocks = [
            'minecraft:stone', 'minecraft:dirt', 'minecraft:grass_block',
            'minecraft:cobblestone', 'minecraft:oak_planks', 'minecraft:spruce_planks',
            'minecraft:birch_planks', 'minecraft:jungle_planks', 'minecraft:acacia_planks',
            'minecraft:dark_oak_planks', 'minecraft:bricks', 'minecraft:stone_bricks',
            'minecraft:white_concrete', 'minecraft:black_concrete', 'minecraft:red_concrete',
            'minecraft:blue_concrete', 'minecraft:green_concrete', 'minecraft:yellow_concrete',
            'minecraft:orange_concrete', 'minecraft:purple_concrete', 'minecraft:pink_concrete',
            'minecraft:lime_concrete', 'minecraft:cyan_concrete', 'minecraft:light_blue_concrete',
            'minecraft:magenta_concrete', 'minecraft:brown_concrete', 'minecraft:light_gray_concrete',
            'minecraft:gray_concrete', 'minecraft:sandstone', 'minecraft:red_sandstone', 'minecraft:glass',
            'minecraft:oak_log', 'minecraft:spruce_log', 'minecraft:birch_log',
            'minecraft:jungle_log', 'minecraft:acacia_log', 'minecraft:dark_oak_log',
            'minecraft:netherrack', 'minecraft:end_stone', 'minecraft:quartz_block',
            'minecraft:iron_block', 'minecraft:gold_block', 'minecraft:diamond_block',
            'minecraft:emerald_block', 'minecraft:coal_block', 'minecraft:redstone_block',
            'minecraft:lapis_block', 'minecraft:wool', 'minecraft:terracotta'
        ];
        
        return placeableBlocks.includes(itemType);
    }

    showHelp(player) {
        const currentRange = this.playerRanges.get(player.name) || 5;
        
        const helpText = `§6§l=== 🪄 VARINHA ULTRA SIMPLES ===

§f§l📋 Como usar:
§81. Pegue um §eGraveto §8(sua varinha)
§82. Tenha blocos no inventário
§83. Segure o graveto e clique direito em um bloco
§84. 5 blocos serão colocados na direção da face clicada

§f§l✨ Funcionalidades:
§8• §aPartículas §8mostram onde você clicou
§8• §bConstrução automática §8de 5 blocos
§8• §eConsome blocos §8do seu inventário
§8• §dCooldown §8de 0.5 segundos

§f§l💡 Dicas:
§8• Funciona com qualquer bloco sólido
§8• Clique na face do bloco para escolher direção
§8• Use §f!wand-help §8para ver esta ajuda

§f§l⚙️ Configuração atual:
§8• Distância: §e${currentRange} blocos

§f§l🎯 Comandos:
§8• §f!range [1-20] §8- Definir distância`;

        player.sendMessage(helpText);
    }
}

// Inicializar sistema
world.sendMessage("§e[Single Wand] Carregando sistema de partícula única...");
const singleWand = new SingleParticleWand();

// Exportar para debug
globalThis.singleWand = singleWand;