import { world, system, Player, ItemStack, BlockPermutation } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

// Sistema de Mineradora Simplificado - Apenas Minérios
class QuarrySystem {
    constructor() {
        this.quarries = new Map();
        this.initialized = false;
        
        // Lista de minérios que podem ser minerados
        this.oreBlocks = new Set([
            'minecraft:coal_ore',
            'minecraft:deepslate_coal_ore',
            'minecraft:iron_ore',
            'minecraft:deepslate_iron_ore',
            'minecraft:copper_ore',
            'minecraft:deepslate_copper_ore',
            'minecraft:gold_ore',
            'minecraft:deepslate_gold_ore',
            'minecraft:redstone_ore',
            'minecraft:deepslate_redstone_ore',
            'minecraft:lapis_ore',
            'minecraft:deepslate_lapis_ore',
            'minecraft:diamond_ore',
            'minecraft:deepslate_diamond_ore',
            'minecraft:emerald_ore',
            'minecraft:deepslate_emerald_ore',
            'minecraft:nether_quartz_ore',
            'minecraft:nether_gold_ore',
            'minecraft:ancient_debris'
        ]);
        
        this.initialize();
    }

    initialize() {
        try {
            
            this.loadData();
            this.setupEvents();
            this.startQuarryOperations();
            this.startPeriodicSave();
            
            this.initialized = true;
            //world.sendMessage("§a[Quarry] Sistema ativo! Minera apenas minérios automaticamente!");
            
        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro: ${error}`);
        }
    }

    setupEvents() {
        try {
            // Colocação do bloco da mineradora
            if (world.afterEvents?.playerPlaceBlock) {
                world.afterEvents.playerPlaceBlock.subscribe((event) => {
                    const { player, block } = event;
                    if (block.typeId === 'quarry:quarry_block') {
                        this.createQuarry(player, block.location);
                    }
                });
            }

            // Interação garantida: só abre interface se estiver segurando um item específico (ex: stick)
            // Interação simples: clique direito no bloco da quarry
            if (world.afterEvents?.playerInteractWithBlock) {
                world.afterEvents.playerInteractWithBlock.subscribe((event) => {
                    const { player, block } = event;
                    if (block && block.typeId === 'quarry:quarry_block') {
                        system.runTimeout(() => {
                            this.openQuarryInterface(player, block.location);
                        }, 1);
                    }
                });
            }

            // Alternativa: usar item no bloco
            if (block.typeId === 'quarry:quarry_block') {
                try {
                    const isLoaded = player.dimension.getBlock(block.location);
                    if (!isLoaded) return; // Evita erro de chunk não carregado
                    this.createQuarry(player, block.location);
                } catch (e) {
                    // Silencia qualquer erro de chunk
                }
            }


            // Quebrar bloco da mineradora
            if (world.beforeEvents?.playerBreakBlock) {
                world.beforeEvents.playerBreakBlock.subscribe((event) => {
                    const { block } = event;
                    if (block.typeId === 'quarry:quarry_block') {
                        this.removeQuarry(block.location);
                    }
                });
            }

            // Comandos de debug
            if (world.beforeEvents?.chatSend) {
                world.beforeEvents.chatSend.subscribe((event) => {
                    const message = event.message.toLowerCase();
                    
                    if (message === "!quarry-debug") {
                        event.cancel = true;
                        const player = event.sender;
                        player.sendMessage(`§6=== QUARRY DEBUG ===`);
                        player.sendMessage(`§8Mineradoras ativas: §f${this.quarries.size}`);
                        
                        let activeCount = 0;
                        for (const [, quarry] of this.quarries) {
                            if (quarry.active) activeCount++;
                        }
                        player.sendMessage(`§8Mineradoras funcionando: §f${activeCount}`);
                    }
                });
            }

        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro nos eventos: ${error}`);
        }
    }

    createQuarry(player, location) {
        try {
            const quarryId = this.getLocationKey(location);
            
            this.quarries.set(quarryId, {
                id: quarryId,
                location: location,
                owner: player.name,
                active: false,
                chestLocation: null,
                currentY: location.y - 1,
                minedBlocks: 0,
                created: Date.now(),
                // Configurações da mineradora
                size: 5, // Tamanho da área (5x5 por padrão)
                maxDepth: 64, // Profundidade máxima (64 blocos por padrão)
                speed: 60 // Velocidade em ticks (60 = 3 segundos por padrão)
            });

            player.sendMessage("§a✅ Mineradora colocada!");
            player.sendMessage("§8Clique direito para configurar");
            
            this.saveData();
            
        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro ao criar mineradora: ${error}`);
        }
    }

    openQuarryInterface(player, location) {
        try {
            const quarryId = this.getLocationKey(location);
            const quarry = this.quarries.get(quarryId);
            
            if (!quarry) {
                player.sendMessage("§c❌ Mineradora não encontrada!");
                return;
            }

            if (quarry.owner !== player.name) {
                player.sendMessage(`§c🛡️ Esta mineradora pertence a §f${quarry.owner}§c!`);
                return;
            }

            const form = new ActionFormData()
                .title("§8 MINERADORA AUTOMATICA")
                .body(`§8Status: ${quarry.active ? '§a ATIVA' : '§c PARADA'}\n§8Baú: ${quarry.chestLocation ? '§a Conectado' : '§c Não conectado'}\n§8Blocos minerados: §f${quarry.minedBlocks}\n§8Profundidade atual: §f${quarry.currentY}\n§8Tamanho: §f${quarry.size}x${quarry.size}\n§8Profundidade máx: §f${quarry.maxDepth}\n§8Velocidade: §f${this.getSpeedDescription(quarry.speed)}\n\n§8Minera apenas minérios automaticamente`)
                .button("§8 CONECTAR BAÚ\n§8Definir baú para armazenar")
                .button("§8 CONFIGURAÇÕES\n§8Tamanho, profundidade e velocidade")
                .button(quarry.active ? "§8 PARAR MINERACAO" : "§8 INICIAR MINERACAO")
                .button("§4 REMOVER MINERADORA\n§8Quebrar e recuperar bloco");

            form.show(player).then((response) => {
                if (response.canceled) return;

                switch (response.selection) {
                    case 0:
                        this.showChestConnectionForm(player, quarry);
                        break;
                    case 1:
                        this.showConfigurationForm(player, quarry);
                        break;
                    case 2:
                        this.toggleQuarryOperation(player, quarry);
                        break;
                    case 3:
                        this.showRemoveConfirmation(player, quarry);
                        break;
                }
            }).catch((error) => {
                player.sendMessage("§c❌ Erro ao abrir interface. Tente novamente!");
                //world.sendMessage(`§c[Quarry] Erro na interface: ${error}`);
            });

        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro na interface: ${error}`);
            player.sendMessage("§c❌ Erro ao abrir interface. Tente novamente!");
        }
    }

    showChestConnectionForm(player, quarry) {
        try {
            const coordString = quarry.chestLocation
                ? `${quarry.chestLocation.x} ${quarry.chestLocation.y} ${quarry.chestLocation.z}`
                : "";
            const form = new ModalFormData()
                .title("§2§l📦 CONECTAR BAÚ")
                .textField("§f§lCoordenadas do baú (X Y Z):", "Ex: 100 64 200", coordString);

            form.show(player).then((response) => {
                if (response.canceled) return;

                const [coordsInput] = response.formValues;
                if (!coordsInput || typeof coordsInput !== "string") {
                    player.sendMessage("§c Coordenadas inválidas!");
                    return;
                }

                // Separar por espaço, vírgula ou ponto e vírgula
                const coords = coordsInput.trim().split(/[\s,;]+/);
                if (coords.length !== 3 || !this.validateCoordinates(...coords)) {
                    player.sendMessage("§c Coordenadas inválidas! Use o formato: X Y Z");
                    return;
                }

                const chestLocation = {
                    x: parseInt(coords[0]),
                    y: parseInt(coords[1]),
                    z: parseInt(coords[2])
                };

                // Verificar se existe um baú na posição
                const block = player.dimension.getBlock(chestLocation);
                if (!block || block.typeId !== 'minecraft:chest') {
                    player.sendMessage("§c Não há um baú nesta posição!");
                    return;
                }

                quarry.chestLocation = chestLocation;
                player.sendMessage("§e Baú conectado com sucesso!");
                
                this.saveData();
            });

        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro na conexão do baú: ${error}`);
        }
    }

    showConfigurationForm(player, quarry) {
        try {
            const form = new ModalFormData()
                .title("§8 CONFIGURAÇÕES DA MINERADORA")
                .slider("§8Tamanho da Área:\n§8Área quadrada de mineração (3x3 até 15x15)", 3, 15, 1, quarry.size)
                .slider("§8Profundidade Máxima:\n§8Quantos blocos para baixo minerar", 10, 128, 1, quarry.maxDepth)
                .dropdown("§8Velocidade de Mineração:\n§8Velocidade de operação da mineradora", [
                    " Muito Lenta (10 segundos)",
                    " Lenta (5 segundos)", 
                    " Normal (3 segundos)",
                    " Rápida (1 segundo)",
                    " Muito Rápida (0.5 segundos)"
                ], this.getSpeedIndex(quarry.speed));

            form.show(player).then((response) => {
                if (response.canceled) return;

                const [size, maxDepth, speedIndex] = response.formValues;
                
                quarry.size = Math.floor(size);
                quarry.maxDepth = Math.floor(maxDepth);
                quarry.speed = this.getSpeedFromIndex(speedIndex);
                
                player.sendMessage("§a Configurações atualizadas!");
                player.sendMessage(`§8Tamanho: §f${quarry.size}x${quarry.size}`);
                player.sendMessage(`§8Profundidade: §f${quarry.maxDepth} blocos`);
                player.sendMessage(`§8Velocidade: §f${this.getSpeedDescription(quarry.speed)}`);
                
                this.saveData();
            });

        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro nas configurações: ${error}`);
        }
    }

    getSpeedDescription(speed) {
        switch (speed) {
            case 200: return "Muito Lenta";
            case 100: return "Lenta";
            case 60: return "Normal";
            case 20: return "Rápida";
            case 10: return "Muito Rápida";
            default: return "Personalizada";
        }
    }

    getSpeedIndex(speed) {
        switch (speed) {
            case 200: return 0; // Muito Lenta
            case 100: return 1; // Lenta
            case 60: return 2;  // Normal
            case 20: return 3;  // Rápida
            case 10: return 4;  // Muito Rápida
            default: return 2;  // Normal como padrão
        }
    }

    getSpeedFromIndex(index) {
        const speeds = [200, 100, 60, 20, 10];
        return speeds[index] || 60;
    }

    toggleQuarryOperation(player, quarry) {
        try {
            if (!quarry.chestLocation) {
                player.sendMessage("§c Conecte um baú primeiro!");
                return;
            }

            // Verificar se o baú ainda existe
            const chestBlock = player.dimension.getBlock(quarry.chestLocation);
            if (!chestBlock || chestBlock.typeId !== 'minecraft:chest') {
                player.sendMessage("§c Baú não encontrado! Reconecte o baú.");
                quarry.chestLocation = null;
                this.saveData();
                return;
            }

            quarry.active = !quarry.active;
            
            if (quarry.active) {
                player.sendMessage("§a✅ Mineradora iniciada!");
                player.sendMessage("§8Minerando apenas minérios automaticamente...");
            } else {
                player.sendMessage("§c⏹️ Mineradora parada!");
            }
            
            this.saveData();
            
        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro ao alternar operação: ${error}`);
        }
    }

    showRemoveConfirmation(player, quarry) {
        try {
            const form = new MessageFormData()
                .title("§8 REMOVER MINERADORA")
                .body("§8 ATENÇÃO!\n\n§fTem certeza que deseja remover esta mineradora?\n\n§8O bloco será devolvido ao seu inventário.")
                .button1("§8 SIM, REMOVER")
                .button2("§8 CANCELAR");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === 1) return;

                // Dar o bloco de volta ao jogador
                const quarryItem = new ItemStack('quarry:quarry_block', 1);
                const inventory = player.getComponent('minecraft:inventory');
                if (inventory?.container) {
                    inventory.container.addItem(quarryItem);
                }

                // Quebrar o bloco
                const block = player.dimension.getBlock(quarry.location);
                if (block) {
                    block.setPermutation(BlockPermutation.resolve('minecraft:air'));
                }

                // Remover dos dados
                this.quarries.delete(quarry.id);
                
                player.sendMessage("§a Mineradora removida e devolvida ao inventário!");
                
                this.saveData();
            });

        } catch (error) {
            //world.sendMessage(`§c[Quarry] Erro na remoção: ${error}`);
        }
    }

    startQuarryOperations() {
        system.runInterval(() => {
            if (!this.initialized) return;

            try {
                for (const [, quarry] of this.quarries) {
                    if (quarry.active && quarry.chestLocation) {
                        this.processQuarryMining(quarry);
                    }
                }
            } catch (error) {
                // Silencioso para não spammar
            }
        }, 20); // Verificar a cada segundo, mas usar velocidade individual
    }

    processQuarryMining(quarry) {
        try {
            // Verificar se é hora de minerar baseado na velocidade configurada
            const now = Date.now();
            if (!quarry.lastMining) quarry.lastMining = 0;
            
            const timeSinceLastMining = now - quarry.lastMining;
            const requiredInterval = quarry.speed * 50; // Converter ticks para ms
            
            if (timeSinceLastMining < requiredInterval) {
                return; // Ainda não é hora de minerar
            }
            
            quarry.lastMining = now;

            // Verificar se ainda há blocos para minerar
            const minY = quarry.location.y - quarry.maxDepth;
            if (quarry.currentY < minY) {
                quarry.active = false;
                // Notificar o dono que a mineração terminou
                const owner = world.getPlayers().find(p => p.name === quarry.owner);
                if (owner) {
                    owner.sendMessage(`§e Mineradora em (${quarry.location.x}, ${quarry.location.y}, ${quarry.location.z}) terminou de minerar!`);
                    owner.sendMessage(`§8 Total minerado: §f${quarry.minedBlocks} blocos`);
                }
                this.saveData();
                return;
            }

            // Área de mineração configurável ao redor da mineradora
            const centerX = quarry.location.x;
            const centerZ = quarry.location.z;
            const currentY = quarry.currentY;
            const halfSize = Math.floor(quarry.size / 2);

            let minedThisRound = false;

            // Minerar na área configurada
            for (let x = centerX - halfSize; x <= centerX + halfSize; x++) {
                for (let z = centerZ - halfSize; z <= centerZ + halfSize; z++) {
                    const blockPos = { x, y: currentY, z };
                    
                    try {
                        const block = world.getDimension('overworld').getBlock(blockPos);
                        if (!block) continue;

                        // Verificar se é um minério
                        if (this.oreBlocks.has(block.typeId)) {
                            // Minerar o bloco
                            const drops = this.getBlockDrops(block.typeId);
                            
                            // Tentar armazenar no baú
                            if (this.storeItemsInChest(quarry.chestLocation, drops)) {
                                // Substituir por ar
                                block.setPermutation(BlockPermutation.resolve('minecraft:air'));
                                quarry.minedBlocks++;
                                minedThisRound = true;
                                
                                // Partícula de mineração
                                world.getDimension('overworld').spawnParticle('minecraft:villager_happy', {
                                    x: blockPos.x + 0.5,
                                    y: blockPos.y + 0.5,
                                    z: blockPos.z + 0.5
                                });
                            }
                        }
                    } catch (error) {
                        // Ignorar erros de blocos individuais
                        continue;
                    }
                }
            }

            // Se não minerou nada nesta camada, descer para a próxima
            if (!minedThisRound) {
                quarry.currentY--;
            }

        } catch (error) {
            // Silencioso
        }
    }

    getBlockDrops(blockType) {
        // Mapear blocos para seus drops
        const dropMap = {
            'minecraft:coal_ore': [{ item: 'minecraft:coal', count: 1 }],
            'minecraft:deepslate_coal_ore': [{ item: 'minecraft:coal', count: 1 }],
            'minecraft:iron_ore': [{ item: 'minecraft:raw_iron', count: 1 }],
            'minecraft:deepslate_iron_ore': [{ item: 'minecraft:raw_iron', count: 1 }],
            'minecraft:copper_ore': [{ item: 'minecraft:raw_copper', count: 2 }],
            'minecraft:deepslate_copper_ore': [{ item: 'minecraft:raw_copper', count: 2 }],
            'minecraft:gold_ore': [{ item: 'minecraft:raw_gold', count: 1 }],
            'minecraft:deepslate_gold_ore': [{ item: 'minecraft:raw_gold', count: 1 }],
            'minecraft:redstone_ore': [{ item: 'minecraft:redstone', count: 4 }],
            'minecraft:deepslate_redstone_ore': [{ item: 'minecraft:redstone', count: 4 }],
            'minecraft:lapis_ore': [{ item: 'minecraft:lapis_lazuli', count: 6 }],
            'minecraft:deepslate_lapis_ore': [{ item: 'minecraft:lapis_lazuli', count: 6 }],
            'minecraft:diamond_ore': [{ item: 'minecraft:diamond', count: 1 }],
            'minecraft:deepslate_diamond_ore': [{ item: 'minecraft:diamond', count: 1 }],
            'minecraft:emerald_ore': [{ item: 'minecraft:emerald', count: 1 }],
            'minecraft:deepslate_emerald_ore': [{ item: 'minecraft:emerald', count: 1 }],
            'minecraft:nether_quartz_ore': [{ item: 'minecraft:quartz', count: 1 }],
            'minecraft:nether_gold_ore': [{ item: 'minecraft:gold_nugget', count: 3 }],
            'minecraft:ancient_debris': [{ item: 'minecraft:ancient_debris', count: 1 }]
        };

        return dropMap[blockType] || [];
    }

    storeItemsInChest(chestLocation, items) {
        try {
            const chestBlock = world.getDimension('overworld').getBlock(chestLocation);
            if (!chestBlock || chestBlock.typeId !== 'minecraft:chest') {
                return false;
            }

            const inventory = chestBlock.getComponent('minecraft:inventory');
            if (!inventory?.container) {
                return false;
            }

            const container = inventory.container;

            // Tentar armazenar cada item
            for (const itemData of items) {
                const itemStack = new ItemStack(itemData.item, itemData.count);
                
                // Verificar se há espaço
                if (container.emptySlotsCount === 0) {
                    // Tentar empilhar com itens existentes
                    let stored = false;
                    for (let i = 0; i < container.size; i++) {
                        const existingItem = container.getItem(i);
                        if (existingItem && 
                            existingItem.typeId === itemStack.typeId && 
                            existingItem.amount < existingItem.maxAmount) {
                            
                            const spaceAvailable = existingItem.maxAmount - existingItem.amount;
                            const amountToAdd = Math.min(spaceAvailable, itemStack.amount);
                            
                            existingItem.amount += amountToAdd;
                            container.setItem(i, existingItem);
                            
                            itemStack.amount -= amountToAdd;
                            if (itemStack.amount <= 0) {
                                stored = true;
                                break;
                            }
                        }
                    }
                    
                    if (!stored) {
                        return false; // Baú cheio
                    }
                } else {
                    // Adicionar em slot vazio
                    container.addItem(itemStack);
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    removeQuarry(location) {
        try {
            const quarryId = this.getLocationKey(location);
            this.quarries.delete(quarryId);
            this.saveData();
            
        } catch (error) {
            // Silencioso
        }
    }

    validateCoordinates(...coords) {
        return coords.every(coord => {
            const num = parseFloat(coord);
            return !isNaN(num) && isFinite(num) && coord !== "" && coord !== null && coord !== undefined;
        });
    }

    getLocationKey(location) {
        return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
    }

    startPeriodicSave() {
        system.runInterval(() => {
            if (this.initialized) {
                this.saveData();
            }
        }, 1200); // Salvar a cada minuto
    }

    saveData() {
        try {
            const saveData = {
                version: "2.0.0",
                quarries: Array.from(this.quarries.entries()),
                timestamp: Date.now()
            };

            world.setDynamicProperty('quarrySystemData', JSON.stringify(saveData));
            
        } catch (error) {
            // Silencioso
        }
    }

    loadData() {
        try {
            const savedData = world.getDynamicProperty('quarrySystemData');
            if (!savedData) return;

            const data = JSON.parse(savedData);
            
            if (data.quarries) {
                this.quarries = new Map(data.quarries);
            }

            const loadTime = data.timestamp ? new Date(data.timestamp).toLocaleString() : "desconhecido";
            //world.sendMessage(`§a[Quarry] Carregado: ${this.quarries.size} mineradoras (salvos em: ${loadTime})`);
            
        } catch (error) {
            this.quarries = new Map();
        }
    }
}

// Inicializar sistema
//world.sendMessage("§e[Quarry] Carregando sistema de mineradora...");
const quarrySystem = new QuarrySystem();

// Exportar para debug
globalThis.quarrySystem = quarrySystem;