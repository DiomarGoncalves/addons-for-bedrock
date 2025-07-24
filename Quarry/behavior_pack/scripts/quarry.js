import { world, system, Player, ItemStack } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

// Sistema de Mineradora Automática
class QuarrySystem {
    constructor() {
        this.quarries = new Map(); // Armazena todas as mineradoras
        this.quarryOwners = new Map(); // Mapeia blocos para donos
        this.activeQuarries = new Set(); // Mineradoras ativas
        this.initialized = false;
        
        // Configurações padrão
        this.defaultConfig = {
            size: 16, // Tamanho padrão 16x16
            depth: -64, // Minerar até Y -64 (bedrock)
            speed: 20, // Velocidade (ticks entre minerações)
            filterMode: 'blacklist', // 'whitelist' ou 'blacklist'
            filters: new Set(['minecraft:bedrock', 'minecraft:air', 'minecraft:water', 'minecraft:lava', 'minecraft:flowing_water', 'minecraft:flowing_lava']), // Filtros padrão
            autoStart: false,
            dropItems: true,
            energyMode: false, // Para futuras expansões
            chestLocation: null, // Localização do baú conectado
            silkTouch: false, // Modo silk touch
            fortune: 0, // Nível de fortune (0-3)
            autoSell: false, // Venda automática (para futuras expansões)
            workingHours: { start: 0, end: 24 }, // Horário de funcionamento
            areaMarkers: { // Marcadores de área
                corner1: null,
                corner2: null
            }
        };
        
        this.initialize();
    }

    initialize() {
        try {
            world.sendMessage("§8[Quarry] Iniciando sistema de mineradora automática...");
            
            this.loadData();
            
            system.runTimeout(() => {
                this.setupEvents();
                this.startQuarryProcessing();
                this.startPeriodicSave();
                this.initialized = true;
                world.sendMessage("§8[Quarry] Sistema de mineradora inicializado com sucesso!");
            }, 100);
            
        } catch (error) {
            world.sendMessage(`§8[Quarry] Erro na inicialização: ${error}`);
            system.runTimeout(() => {
                this.initialize();
            }, 200);
        }
    }

    // Sistema de salvamento
    saveData() {
        try {
            if (this.quarries.size === 0 && this.quarryOwners.size === 0) {
                return;
            }

            const saveData = {
                version: "1.0.0",
                quarries: Array.from(this.quarries.entries()).map(([id, quarry]) => [
                    id,
                    {
                        ...quarry,
                        filters: Array.from(quarry.config.filters),
                        config: {
                            ...quarry.config,
                            filters: Array.from(quarry.config.filters)
                        }
                    }
                ]),
                quarryOwners: Array.from(this.quarryOwners.entries()),
                activeQuarries: Array.from(this.activeQuarries),
                timestamp: Date.now()
            };

            world.setDynamicProperty('quarryData', JSON.stringify(saveData));
            
        } catch (error) {
            world.sendMessage(`§8[Quarry] Erro ao salvar dados: ${error}`);
        }
    }

    loadData() {
        try {
            const savedData = world.getDynamicProperty('quarryData');
            if (!savedData) return;

            const data = JSON.parse(savedData);
            
            if (data.quarries) {
                this.quarries = new Map(data.quarries.map(([id, quarry]) => [
                    id,
                    {
                        ...quarry,
                        config: {
                            ...quarry.config,
                            filters: new Set(quarry.config.filters)
                        }
                    }
                ]));
            }

            if (data.quarryOwners) {
                this.quarryOwners = new Map(data.quarryOwners);
            }

            if (data.activeQuarries) {
                this.activeQuarries = new Set(data.activeQuarries);
            }

            const loadTime = data.timestamp ? new Date(data.timestamp).toLocaleString() : "desconhecido";
            world.sendMessage(`§8[Quarry] Dados carregados: ${this.quarries.size} mineradoras (salvos em: ${loadTime})`);
            
        } catch (error) {
            world.sendMessage(`§8[Quarry] Erro ao carregar dados: ${error}`);
            this.quarries = new Map();
            this.quarryOwners = new Map();
            this.activeQuarries = new Set();
        }
    }

    startPeriodicSave() {
        system.runInterval(() => {
            if (this.initialized) {
                try {
                    this.saveData();
                } catch (error) {
                    world.sendMessage(`§8[Quarry] Erro no salvamento automático: ${error}`);
                }
            }
        }, 1200); // A cada minuto
    }

    setupEvents() {
        try {
            // Evento de colocação do bloco
            if (world.afterEvents && world.afterEvents.playerPlaceBlock) {
                world.afterEvents.playerPlaceBlock.subscribe((event) => {
                    try {
                        const { player, block } = event;
                        
                        if (!player || !block) return;
                        
                        if (block.typeId === 'quarry:quarry_block') {
                            const blockKey = this.getBlockKey(block.location);
                            this.quarryOwners.set(blockKey, player.name);
                            
                            // Criar nova mineradora
                            const quarryId = this.createQuarry(player, block.location);
                            
                            system.runTimeout(() => {
                                this.saveData();
                            }, 20);
                            
                            world.sendMessage(`§8[Quarry] ${player.name} colocou uma mineradora em (${block.location.x}, ${block.location.y}, ${block.location.z})`);
                            player.sendMessage("§8Mineradora colocada! Clique com botão direito para configurar.");
                        }
                    } catch (error) {
                        world.sendMessage(`§8[Error] Erro no evento de colocação: ${error}`);
                    }
                });
            }

            // Evento de interação com o bloco
            if (world.afterEvents && world.afterEvents.itemUse) {
                world.afterEvents.itemUse.subscribe((event) => {
                    try {
                        const { source: player } = event;
                        
                        if (!player || !player.isValid()) return;
                        
                        const blockRaycast = player.getBlockFromViewDirection();
                        if (!blockRaycast || !blockRaycast.block) return;
                        
                        const block = blockRaycast.block;
                        
                        if (block.typeId === 'quarry:quarry_block') {
                            const blockKey = this.getBlockKey(block.location);
                            const blockOwner = this.quarryOwners.get(blockKey);
                            
                            if (!blockOwner) {
                                player.sendMessage("§8Esta mineradora não tem dono registrado! Quebre e coloque novamente.");
                                return;
                            }
                            
                            if (blockOwner !== player.name) {
                                player.sendMessage(`§8Esta mineradora pertence a ${blockOwner}! Apenas o dono pode acessá-la.`);
                                return;
                            }
                            
                            system.runTimeout(() => {
                                this.openQuarryInterface(player, block.location);
                            }, 2);
                        }
                    } catch (error) {
                        world.sendMessage(`§8[Error] Erro no evento itemUse: ${error}`);
                    }
                });
            }

            // Evento de quebrar bloco
            if (world.beforeEvents && world.beforeEvents.playerBreakBlock) {
                world.beforeEvents.playerBreakBlock.subscribe((event) => {
                    try {
                        const { player, block } = event;
                        
                        if (!player || !block) return;
                        
                        if (block.typeId === 'quarry:quarry_block') {
                            const blockKey = this.getBlockKey(block.location);
                            const blockOwner = this.quarryOwners.get(blockKey);
                            
                            if (!blockOwner) {
                                world.sendMessage(`§8[Quarry] Mineradora sem dono removida`);
                                return;
                            }
                            
                            if (blockOwner !== player.name) {
                                event.cancel = true;
                                player.sendMessage(`§8Você não pode quebrar esta mineradora! Ela pertence a ${blockOwner}.`);
                                return;
                            }
                            
                            // Limpar dados da mineradora
                            const quarryId = this.findQuarryByLocation(block.location);
                            if (quarryId) {
                                this.quarries.delete(quarryId);
                                this.activeQuarries.delete(quarryId);
                            }
                            this.quarryOwners.delete(blockKey);
                            
                            system.runTimeout(() => {
                                this.saveData();
                            }, 20);
                            
                            world.sendMessage(`§8[Quarry] ${player.name} removeu sua mineradora`);
                        }
                    } catch (error) {
                        world.sendMessage(`§8[Error] Erro no evento de quebrar bloco: ${error}`);
                    }
                });
            }

            // Comandos de debug
            if (world.beforeEvents && world.beforeEvents.chatSend) {
                world.beforeEvents.chatSend.subscribe((event) => {
                    try {
                        const message = event.message.toLowerCase();
                        
                        if (message === "!quarry-debug") {
                            event.cancel = true;
                            const player = event.sender;
                            
                            player.sendMessage("§8=== DEBUG QUARRY SYSTEM ===");
                            player.sendMessage(`§8Mineradoras registradas: ${this.quarries.size}`);
                            player.sendMessage(`§8Mineradoras ativas: ${this.activeQuarries.size}`);
                            player.sendMessage(`§8Blocos registrados: ${this.quarryOwners.size}`);
                            player.sendMessage(`§8Sistema inicializado: ${this.initialized}`);
                        }
                        
                        if (message === "!quarry-stop-all") {
                            event.cancel = true;
                            this.activeQuarries.clear();
                            event.sender.sendMessage("§8[Quarry] Todas as mineradoras foram paradas!");
                        }
                        
                        if (message === "!quarry-save") {
                            event.cancel = true;
                            this.saveData();
                            event.sender.sendMessage("§8[Quarry] Dados salvos manualmente!");
                        }
                        
                    } catch (error) {
                        world.sendMessage(`§8[Error] Erro no evento de chat: ${error}`);
                    }
                });
            }

            world.sendMessage("§8[Quarry] Todos os eventos configurados!");

        } catch (error) {
            world.sendMessage(`§8[Quarry] Erro ao configurar eventos: ${error}`);
        }
    }

    getBlockKey(location) {
        return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
    }

    createQuarry(owner, location) {
        const quarryId = `quarry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const quarry = {
            id: quarryId,
            owner: owner.name,
            location: {
                x: Math.floor(location.x),
                y: Math.floor(location.y),
                z: Math.floor(location.z)
            },
            config: {
                ...this.defaultConfig,
                filters: new Set(this.defaultConfig.filters)
            },
            status: 'stopped',
            progress: {
                currentX: Math.floor(location.x) - Math.floor(this.defaultConfig.size / 2),
                currentY: Math.floor(location.y) - 1,
                currentZ: Math.floor(location.z) - Math.floor(this.defaultConfig.size / 2),
                blocksMinedTotal: 0,
                blocksMinedSession: 0
            },
            created: new Date().toISOString(),
            lastActive: null
        };

        this.quarries.set(quarryId, quarry);
        return quarryId;
    }

    findQuarryByLocation(location) {
        const locationKey = this.getBlockKey(location);
        for (const [quarryId, quarry] of this.quarries) {
            const quarryLocationKey = this.getBlockKey(quarry.location);
            if (quarryLocationKey === locationKey) {
                return quarryId;
            }
        }
        return null;
    }

    openQuarryInterface(player, location) {
        if (!player || !player.isValid()) {
            world.sendMessage("§8[Error] Jogador inválido para abrir interface");
            return;
        }

        const quarryId = this.findQuarryByLocation(location);
        if (!quarryId) {
            player.sendMessage("§8Mineradora não encontrada!");
            return;
        }

        const quarry = this.quarries.get(quarryId);
        const isActive = this.activeQuarries.has(quarryId);

        try {
            const form = new ActionFormData()
                .title("§8MINERADORA AUTOMATICA")
                .body(`§8Status: ${isActive ? 'ATIVA' : 'PARADA'}\n§8Blocos Minerados: ${quarry.progress.blocksMinedTotal}\n§8Tamanho: ${quarry.config.size}x${quarry.config.size}\n§8Profundidade: Y ${quarry.config.depth}\n\n§8Use as opcoes abaixo para gerenciar sua mineradora`)
                .button(`§8${isActive ? 'PARAR' : 'INICIAR'} MINERADORA\n§8${isActive ? 'Parar mineracao' : 'Comecar a minerar'}`)
                .button("§8CONFIGURAR TAMANHO\n§8Definir area de mineracao")
                .button("§8CONFIGURAR FILTROS\n§8Whitelist/Blacklist de blocos")
                .button("§8CONECTAR BAU\n§8Definir bau para itens")
                .button("§8ESTATISTICAS\n§8Ver progresso detalhado")
                .button("§8CONFIGURAR ENCANTAMENTOS\n§8Silk Touch e Fortune")
                .button("§8RESETAR PROGRESSO\n§8Reiniciar mineracao")
                .button("§8INFORMACOES\n§8Detalhes da mineradora");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === undefined) return;

                switch (response.selection) {
                    case 0:
                        this.toggleQuarry(player, quarryId);
                        break;
                    case 1:
                        this.showSizeConfigForm(player, quarryId);
                        break;
                    case 2:
                        this.showFilterConfigForm(player, quarryId);
                        break;
                    case 3:
                        this.showChestConfigForm(player, quarryId);
                        break;
                    case 4:
                        this.showAreaDelimitationForm(player, quarryId);
                        break;
                    case 5:
                        this.showQuarryStats(player, quarryId);
                        break;
                    case 6:
                        this.showWorkingHoursForm(player, quarryId);
                        break;
                    case 7:
                        this.resetQuarryProgress(player, quarryId);
                        break;
                    case 9:
                        this.showEnchantmentConfigForm(player, quarryId);
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao mostrar interface: ${error}`);
            });

        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar interface: ${error}`);
        }
    }

    showChestConfigForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const currentChest = quarry.config.chestLocation;
            const chestStatus = currentChest ? `Conectado em (${currentChest.x}, ${currentChest.y}, ${currentChest.z})` : "Nenhum bau conectado";

            const form = new ActionFormData()
                .title("§8CONECTAR BAU")
                .body(`§8Status atual: ${chestStatus}\n\n§8Configure um bau para armazenar automaticamente os itens minerados`)
                .button("§8DEFINIR BAU\n§8Configurar coordenadas do bau")
                .button("§8REMOVER BAU\n§8Desconectar bau atual")
                .button("§8TESTAR CONEXAO\n§8Verificar se o bau existe");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === undefined) return;

                switch (response.selection) {
                    case 0:
                        this.showChestLocationForm(player, quarryId);
                        break;
                    case 1:
                        quarry.config.chestLocation = null;
                        this.saveData();
                        player.sendMessage("§8Bau desconectado!");
                        break;
                    case 2:
                        this.testChestConnection(player, quarryId);
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro no formulário de bau: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de bau: ${error}`);
        }
    }

    showChestLocationForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const currentChest = quarry.config.chestLocation || { x: 0, y: 64, z: 0 };

            const form = new ModalFormData()
                .title("§8DEFINIR LOCALIZACAO DO BAU")
                .textField("§8Coordenada X do bau:", "Ex: 100", currentChest.x.toString())
                .textField("§8Coordenada Y do bau:", "Ex: 64", currentChest.y.toString())
                .textField("§8Coordenada Z do bau:", "Ex: 200", currentChest.z.toString());

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [chestX, chestY, chestZ] = response.formValues;

                if (!this.validateCoordinates(chestX, chestY, chestZ)) {
                    player.sendMessage("§8Coordenadas do bau invalidas!");
                    return;
                }

                quarry.config.chestLocation = {
                    x: parseInt(chestX),
                    y: parseInt(chestY),
                    z: parseInt(chestZ)
                };

                this.saveData();

                player.sendMessage("§8Bau configurado com sucesso!");
                player.sendMessage(`§8Localizacao: (${chestX}, ${chestY}, ${chestZ})`);
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao configurar bau: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de localização do bau: ${error}`);
        }
    }

    testChestConnection(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry || !quarry.config.chestLocation) {
            player.sendMessage("§8Nenhum bau configurado!");
            return;
        }

        try {
            const dimension = world.getDimension('overworld');
            const chestBlock = dimension.getBlock(quarry.config.chestLocation);
            
            if (chestBlock && chestBlock.typeId === 'minecraft:chest') {
                player.sendMessage("§8Conexao com o bau OK!");
            } else {
                player.sendMessage("§8Erro: Nao foi encontrado um bau na localizacao especificada!");
            }
        } catch (error) {
            player.sendMessage("§8Erro ao testar conexao com o bau!");
        }
    }

    showAreaDelimitationForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const markers = quarry.config.areaMarkers;
            const corner1Status = markers.corner1 ? `(${markers.corner1.x}, ${markers.corner1.z})` : "Nao definido";
            const corner2Status = markers.corner2 ? `(${markers.corner2.x}, ${markers.corner2.z})` : "Nao definido";

            const form = new ActionFormData()
                .title("§8DELIMITAR AREA DE MINERACAO")
                .body(`§8Canto 1: ${corner1Status}\n§8Canto 2: ${corner2Status}\n\n§8Defina os cantos da area de mineracao para controle preciso`)
                .button("§8DEFINIR CANTO 1\n§8Marcar primeiro canto")
                .button("§8DEFINIR CANTO 2\n§8Marcar segundo canto")
                .button("§8USAR AREA ATUAL\n§8Aplicar delimitacao definida")
                .button("§8LIMPAR MARCADORES\n§8Remover delimitacao");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === undefined) return;

                switch (response.selection) {
                    case 0:
                        this.showCornerDefinitionForm(player, quarryId, 1);
                        break;
                    case 1:
                        this.showCornerDefinitionForm(player, quarryId, 2);
                        break;
                    case 2:
                        this.applyAreaDelimitation(player, quarryId);
                        break;
                    case 3:
                        quarry.config.areaMarkers = { corner1: null, corner2: null };
                        this.saveData();
                        player.sendMessage("§8Marcadores de area removidos!");
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro no formulário de delimitação: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de delimitação: ${error}`);
        }
    }

    showCornerDefinitionForm(player, quarryId, cornerNumber) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const currentCorner = cornerNumber === 1 ? quarry.config.areaMarkers.corner1 : quarry.config.areaMarkers.corner2;
            const defaultX = currentCorner ? currentCorner.x.toString() : quarry.location.x.toString();
            const defaultZ = currentCorner ? currentCorner.z.toString() : quarry.location.z.toString();

            const form = new ModalFormData()
                .title(`§8DEFINIR CANTO ${cornerNumber}`)
                .textField("§8Coordenada X:", "Ex: 100", defaultX)
                .textField("§8Coordenada Z:", "Ex: 200", defaultZ);

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [cornerX, cornerZ] = response.formValues;

                if (!this.validateCoordinates(cornerX, "64", cornerZ)) {
                    player.sendMessage("§8Coordenadas do canto invalidas!");
                    return;
                }

                const cornerData = {
                    x: parseInt(cornerX),
                    z: parseInt(cornerZ)
                };

                if (cornerNumber === 1) {
                    quarry.config.areaMarkers.corner1 = cornerData;
                } else {
                    quarry.config.areaMarkers.corner2 = cornerData;
                }

                this.saveData();

                player.sendMessage(`§8Canto ${cornerNumber} definido em (${cornerX}, ${cornerZ})!`);
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao definir canto: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de canto: ${error}`);
        }
    }

    applyAreaDelimitation(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        const { corner1, corner2 } = quarry.config.areaMarkers;

        if (!corner1 || !corner2) {
            player.sendMessage("§8Defina ambos os cantos antes de aplicar a delimitacao!");
            return;
        }

        // Calcular área baseada nos cantos
        const minX = Math.min(corner1.x, corner2.x);
        const maxX = Math.max(corner1.x, corner2.x);
        const minZ = Math.min(corner1.z, corner2.z);
        const maxZ = Math.max(corner1.z, corner2.z);

        const width = maxX - minX + 1;
        const length = maxZ - minZ + 1;

        // Atualizar configurações da mineradora
        quarry.config.customArea = {
            minX: minX,
            maxX: maxX,
            minZ: minZ,
            maxZ: maxZ,
            width: width,
            length: length
        };

        // Resetar progresso para usar nova área
        quarry.progress = {
            currentX: minX,
            currentY: quarry.location.y - 1,
            currentZ: minZ,
            blocksMinedTotal: 0,
            blocksMinedSession: 0
        };

        this.saveData();

        player.sendMessage("§8Area delimitada aplicada com sucesso!");
        player.sendMessage(`§8Dimensoes: ${width}x${length} blocos`);
        player.sendMessage(`§8Area: (${minX}, ${minZ}) ate (${maxX}, ${maxZ})`);
    }

    toggleQuarry(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        if (this.activeQuarries.has(quarryId)) {
            this.activeQuarries.delete(quarryId);
            quarry.status = 'stopped';
            player.sendMessage("§8Mineradora parada!");
        } else {
            this.activeQuarries.add(quarryId);
            quarry.status = 'active';
            quarry.lastActive = new Date().toISOString();
            quarry.progress.blocksMinedSession = 0;
            player.sendMessage("§8Mineradora iniciada!");
        }

        this.saveData();
    }

    showSizeConfigForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const form = new ModalFormData()
                .title("§8CONFIGURAR TAMANHO")
                .textField("§8Tamanho da Area (NxN):\n§8Tamanho da area quadrada para minerar", "Ex: 16", quarry.config.size.toString())
                .textField("§8Profundidade Minima (Y):\n§8Ate que altura minerar (padrao: -64)", "Ex: -64", quarry.config.depth.toString())
                .textField("§8Velocidade (ticks):\n§8Tempo entre mineracoes (menor = mais rapido)", "Ex: 20", quarry.config.speed.toString());

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [sizeStr, depthStr, speedStr] = response.formValues;
                
                const size = parseInt(sizeStr);
                const depth = parseInt(depthStr);
                const speed = parseInt(speedStr);

                if (isNaN(size) || size < 1 || size > 64) {
                    player.sendMessage("§8Tamanho deve ser entre 1 e 64!");
                    return;
                }

                if (isNaN(depth) || depth > quarry.location.y) {
                    player.sendMessage("§8Profundidade invalida!");
                    return;
                }

                if (isNaN(speed) || speed < 1) {
                    player.sendMessage("§8Velocidade deve ser maior que 0!");
                    return;
                }

                quarry.config.size = size;
                quarry.config.depth = depth;
                quarry.config.speed = speed;

                this.saveData();

                player.sendMessage("§8Configuracoes de tamanho atualizadas!");
                player.sendMessage(`§8Area: ${size}x${size} ate Y ${depth}`);
                player.sendMessage(`§8Velocidade: ${speed} ticks`);
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro no formulário de tamanho: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de tamanho: ${error}`);
        }
    }

    showFilterConfigForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const form = new ActionFormData()
                .title("§8CONFIGURAR FILTROS")
                .body(`§8Modo Atual: ${quarry.config.filterMode.toUpperCase()}\n§8Filtros Ativos: ${quarry.config.filters.size}\n\n§8Whitelist: Minera APENAS os blocos da lista\n§8Blacklist: Minera TUDO EXCETO os blocos da lista`)
                .button(`§8ALTERNAR MODO\n§8Mudar para ${quarry.config.filterMode === 'whitelist' ? 'Blacklist' : 'Whitelist'}`)
                .button("§8ADICIONAR BLOCO\n§8Adicionar bloco ao filtro")
                .button("§8REMOVER BLOCO\n§8Remover bloco do filtro")
                .button("§8LISTAR FILTROS\n§8Ver todos os blocos filtrados")
                .button("§8LIMPAR FILTROS\n§8Remover todos os filtros");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === undefined) return;

                switch (response.selection) {
                    case 0:
                        quarry.config.filterMode = quarry.config.filterMode === 'whitelist' ? 'blacklist' : 'whitelist';
                        this.saveData();
                        player.sendMessage(`§8Modo alterado para: ${quarry.config.filterMode.toUpperCase()}`);
                        break;
                    case 1:
                        this.showAddFilterForm(player, quarryId);
                        break;
                    case 2:
                        this.showRemoveFilterForm(player, quarryId);
                        break;
                    case 3:
                        this.showFilterList(player, quarryId);
                        break;
                    case 4:
                        quarry.config.filters.clear();
                        quarry.config.filters.add('minecraft:bedrock'); // Sempre manter bedrock
                        this.saveData();
                        player.sendMessage("§8Filtros limpos! (bedrock mantida por seguranca)");
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro no formulário de filtros: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de filtros: ${error}`);
        }
    }

    showAddFilterForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const form = new ModalFormData()
                .title("§8ADICIONAR BLOCO AO FILTRO")
                .textField("§8ID do Bloco:\n§8Digite o ID completo do bloco (ex: minecraft:stone)", "minecraft:stone", "");

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const blockId = response.formValues[0].trim();
                
                if (!blockId || !blockId.includes(':')) {
                    player.sendMessage("§8ID do bloco invalido! Use o formato 'minecraft:nome_do_bloco'");
                    return;
                }

                quarry.config.filters.add(blockId);
                this.saveData();

                player.sendMessage(`§8Bloco ${blockId} adicionado ao filtro!`);
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao adicionar filtro: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de adicionar filtro: ${error}`);
        }
    }

    showRemoveFilterForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const form = new ModalFormData()
                .title("§8REMOVER BLOCO DO FILTRO")
                .textField("§8ID do Bloco:\n§8Digite o ID do bloco para remover", "minecraft:stone", "");

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const blockId = response.formValues[0].trim();
                
                if (blockId === 'minecraft:bedrock') {
                    player.sendMessage("§8Nao e possivel remover bedrock do filtro por seguranca!");
                    return;
                }

                if (quarry.config.filters.has(blockId)) {
                    quarry.config.filters.delete(blockId);
                    this.saveData();
                    player.sendMessage(`§8Bloco ${blockId} removido do filtro!`);
                } else {
                    player.sendMessage(`§8Bloco ${blockId} nao esta no filtro!`);
                }
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao remover filtro: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de remover filtro: ${error}`);
        }
    }

    showFilterList(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        let filterList = `§8=== FILTROS ATIVOS ===\n`;
        filterList += `§8Modo: ${quarry.config.filterMode.toUpperCase()}\n\n`;
        
        if (quarry.config.filters.size === 0) {
            filterList += "§8Nenhum filtro configurado.";
        } else {
            filterList += "§8Blocos Filtrados:\n";
            Array.from(quarry.config.filters).forEach((blockId, index) => {
                filterList += `§8${index + 1}. ${blockId}\n`;
            });
        }

        player.sendMessage(filterList);
    }

    showQuarryStats(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        const isActive = this.activeQuarries.has(quarryId);
        let totalArea, totalDepth, totalBlocks;

        if (quarry.config.customArea) {
            totalArea = quarry.config.customArea.width * quarry.config.customArea.length;
            totalDepth = quarry.location.y - quarry.config.depth;
            totalBlocks = totalArea * totalDepth;
        } else {
            totalArea = quarry.config.size * quarry.config.size;
            totalDepth = quarry.location.y - quarry.config.depth;
            totalBlocks = totalArea * totalDepth;
        }

        const progress = totalBlocks > 0 ? ((quarry.progress.blocksMinedTotal / totalBlocks) * 100).toFixed(1) : 0;

        let stats = `§8=== ESTATISTICAS DA MINERADORA ===\n`;
        stats += `§8Status: ${isActive ? 'ATIVA' : 'PARADA'}\n`;
        stats += `§8Progresso: ${progress}% (${quarry.progress.blocksMinedTotal}/${totalBlocks})\n`;
        stats += `§8Blocos Minerados (Total): ${quarry.progress.blocksMinedTotal}\n`;
        stats += `§8Blocos Minerados (Sessao): ${quarry.progress.blocksMinedSession}\n`;
        stats += `§8Posicao Atual: (${quarry.progress.currentX}, ${quarry.progress.currentY}, ${quarry.progress.currentZ})\n`;
        
        if (quarry.config.customArea) {
            stats += `§8Area Delimitada: ${quarry.config.customArea.width}x${quarry.config.customArea.length}\n`;
        } else {
            stats += `§8Area: ${quarry.config.size}x${quarry.config.size}\n`;
        }
        
        stats += `§8Profundidade: Y ${quarry.location.y} ate Y ${quarry.config.depth}\n`;
        stats += `§8Velocidade: ${quarry.config.speed} ticks\n`;
        stats += `§8Criada em: ${new Date(quarry.created).toLocaleDateString()}`;

        if (quarry.lastActive) {
            stats += `\n§8Ultima Atividade: ${new Date(quarry.lastActive).toLocaleString()}`;
        }

        player.sendMessage(stats);
    }

    resetQuarryProgress(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        try {
            const form = new MessageFormData()
                .title("§8RESETAR PROGRESSO")
                .body("§8ATENCAO!\n\n§8Tem certeza que deseja resetar o progresso da mineradora?\n\n§8Esta acao ira:\n§8• Resetar a posicao atual\n§8• Zerar contadores de blocos\n§8• Reiniciar a mineracao do inicio")
                .button1("§8SIM, RESETAR")
                .button2("§8CANCELAR");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === 1) return;

                // Resetar progresso
                if (quarry.config.customArea) {
                    quarry.progress = {
                        currentX: quarry.config.customArea.minX,
                        currentY: quarry.location.y - 1,
                        currentZ: quarry.config.customArea.minZ,
                        blocksMinedTotal: 0,
                        blocksMinedSession: 0
                    };
                } else {
                    quarry.progress = {
                        currentX: quarry.location.x - Math.floor(quarry.config.size / 2),
                        currentY: quarry.location.y - 1,
                        currentZ: quarry.location.z - Math.floor(quarry.config.size / 2),
                        blocksMinedTotal: 0,
                        blocksMinedSession: 0
                    };
                }

                this.saveData();

                player.sendMessage("§8Progresso da mineradora resetado!");
                player.sendMessage("§8A mineradora comecara a minerar do inicio novamente.");
            }).catch((error) => {
                world.sendMessage(`§8[Error] Erro ao resetar progresso: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao criar formulário de reset: ${error}`);
        }
    }

    showQuarryInfo(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) return;

        const memberCount = 0; // Para futuras expansões
        const chestStatus = quarry.config.chestLocation ? `(${quarry.config.chestLocation.x}, ${quarry.config.chestLocation.y}, ${quarry.config.chestLocation.z})` : "Nao configurado";
        
        let info = `§8=== INFORMACOES DA MINERADORA ===\n`;
        info += `§8Dono: ${quarry.owner}\n`;
        info += `§8Localizacao: (${quarry.location.x}, ${quarry.location.y}, ${quarry.location.z})\n`;
        info += `§8ID: ${quarry.id}\n`;
        info += `§8Criada: ${new Date(quarry.created).toLocaleDateString()}\n`;
        info += `§8Modo de Filtro: ${quarry.config.filterMode.toUpperCase()}\n`;
        info += `§8Filtros Ativos: ${quarry.config.filters.size}\n`;
        info += `§8Velocidade: ${quarry.config.speed} ticks\n`;
        info += `§8Drop de Itens: ${quarry.config.dropItems ? 'SIM' : 'NAO'}\n`;
        info += `§8Bau Conectado: ${chestStatus}`;

        if (quarry.config.customArea) {
            info += `\n§8Area Delimitada: ${quarry.config.customArea.width}x${quarry.config.customArea.length}`;
        }

        player.sendMessage(info);
    }

    showEnchantmentConfigForm(player, quarryId) {
        const quarry = this.quarries.get(quarryId);
        if (!quarry) {
            player.sendMessage("§c❌ Mineradora não encontrada!");
            return;
        }

        const currentSilk = quarry.config.silkTouch || false;
        const currentFortune = quarry.config.fortune || 0;

        try {
            const form = new ModalFormData()
                .title("§d§l✨ CONFIGURAR ENCANTAMENTOS")
                .toggle("§f§lSilk Touch:\n§7Minera blocos sem quebrar (ex: pedra vira pedra)", currentSilk)
                .slider("§f§lFortune:\n§7Aumenta drops de minérios", 0, 3, 1, currentFortune);

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [silkTouch, fortune] = response.formValues;
                
                // Salvar encantamentos
                quarry.config.silkTouch = silkTouch;
                quarry.config.fortune = Math.floor(fortune);
                
                this.saveData();
                
                player.sendMessage("§a✅ Encantamentos configurados com sucesso!");
                player.sendMessage(`§7Silk Touch: §f${silkTouch ? "Ativado" : "Desativado"}`);
                player.sendMessage(`§7Fortune: §f${Math.floor(fortune)}`);
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro na configuração de encantamentos: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de encantamentos: ${error}`);
        }
    }

    validateCoordinates(...coords) {
        return coords.every(coord => {
            const num = parseFloat(coord);
            return !isNaN(num) && isFinite(num) && coord !== "" && coord !== null && coord !== undefined;
        });
    }

    // Sistema de processamento das mineradoras
    startQuarryProcessing() {
        system.runInterval(() => {
            if (!this.initialized || this.activeQuarries.size === 0) return;

            try {
                for (const quarryId of this.activeQuarries) {
                    const quarry = this.quarries.get(quarryId);
                    if (!quarry) {
                        this.activeQuarries.delete(quarryId);
                        continue;
                    }

                    this.processQuarryStep(quarry);
                }
            } catch (error) {
                world.sendMessage(`§8[Error] Erro no processamento das mineradoras: ${error}`);
            }
        }, 1); // Verificar a cada tick
    }

    processQuarryStep(quarry) {
        try {
            // Verificar se é hora de minerar (baseado na velocidade)
            const currentTick = system.currentTick;
            if (!quarry.lastMiningTick) {
                quarry.lastMiningTick = currentTick;
            }

            if (currentTick - quarry.lastMiningTick < quarry.config.speed) {
                return; // Ainda não é hora de minerar
            }

            quarry.lastMiningTick = currentTick;

            // Verificar se chegou ao fim da área
            if (this.isQuarryComplete(quarry)) {
                this.activeQuarries.delete(quarry.id);
                quarry.status = 'completed';
                
                // Notificar o dono se estiver online
                const owner = world.getPlayers().find(p => p.name === quarry.owner);
                if (owner) {
                    owner.sendMessage("§8Sua mineradora completou a area de mineracao!");
                }
                
                world.sendMessage(`§8[Quarry] Mineradora de ${quarry.owner} completou a mineracao!`);
                return;
            }

            // Minerar o bloco atual
            this.mineCurrentBlock(quarry);

            // Avançar para o próximo bloco
            this.advanceQuarryPosition(quarry);

        } catch (error) {
            world.sendMessage(`§8[Error] Erro no processamento da mineradora ${quarry.id}: ${error}`);
        }
    }

    mineCurrentBlock(quarry) {
        try {
            const { currentX, currentY, currentZ } = quarry.progress;
            
            // Verificar se a posição é válida
            if (currentY <= quarry.config.depth) {
                return; // Chegou na profundidade máxima
            }

            // Tentar obter o bloco na posição atual
            const dimension = world.getDimension('overworld');
            let block;
            
            try {
                block = dimension.getBlock({ x: currentX, y: currentY, z: currentZ });
            } catch (error) {
                // Chunk não carregado, pular este bloco
                return;
            }

            if (!block) return;

            const blockType = block.typeId;

            // Verificar filtros
            if (!this.shouldMineBlock(blockType, quarry.config)) {
                return; // Bloco filtrado, não minerar
            }

            // Não minerar bedrock por segurança
            if (blockType === 'minecraft:bedrock') {
                return;
            }

            // Não minerar ar
            if (blockType === 'minecraft:air') {
                return;
            }

            // Minerar o bloco
            if (quarry.config.dropItems) {
                try {
                    const drops = this.getBlockDrops(blockType, quarry.config);
                    
                    // Se há baú conectado, tentar colocar itens no baú
                    if (quarry.config.chestLocation) {
                        this.addItemsToChest(quarry.config.chestLocation, drops);
                    } else {
                        // Dropar itens na posição da mineradora
                        for (const drop of drops) {
                            dimension.spawnItem(drop, quarry.location);
                        }
                    }
                } catch (error) {
                    // Se não conseguir dropar, apenas quebrar o bloco
                }
            }

            // Quebrar o bloco (substituir por ar)
            block.setType('minecraft:air');

            // Atualizar estatísticas
            quarry.progress.blocksMinedTotal++;
            quarry.progress.blocksMinedSession++;

            // Efeitos visuais (opcional)
            try {
                dimension.spawnParticle('minecraft:villager_happy', { x: currentX, y: currentY, z: currentZ });
            } catch (error) {
                // Ignorar erro de partículas
            }

        } catch (error) {
            world.sendMessage(`§8[Error] Erro ao minerar bloco: ${error}`);
        }
    }

    addItemsToChest(chestLocation, items) {
        try {
            const dimension = world.getDimension('overworld');
            const chestBlock = dimension.getBlock(chestLocation);
            
            if (!chestBlock || chestBlock.typeId !== 'minecraft:chest') {
                return; // Não é um baú válido
            }

            const container = chestBlock.getComponent('minecraft:inventory').container;
            
            for (const item of items) {
                // Tentar adicionar item ao baú
                try {
                    container.addItem(item);
                } catch (error) {
                    // Se o baú estiver cheio, dropar no chão
                    dimension.spawnItem(item, chestLocation);
                }
            }
        } catch (error) {
            // Em caso de erro, dropar itens no chão
            const dimension = world.getDimension('overworld');
            for (const item of items) {
                dimension.spawnItem(item, chestLocation);
            }
        }
    }

    shouldMineBlock(blockType, config) {
        const isInFilter = config.filters.has(blockType);
        
        if (config.filterMode === 'whitelist') {
            return isInFilter; // Minerar apenas se estiver na whitelist
        } else {
            return !isInFilter; // Minerar apenas se NÃO estiver na blacklist
        }
    }

    getBlockDrops(blockType, config) {
        // Drops básicos para alguns blocos comuns
        const drops = [];
        
        // Se silk touch estiver ativo, dropar o bloco original
        if (config.silkTouch) {
            try {
                drops.push(new ItemStack(blockType, 1));
                return drops;
            } catch (error) {
                // Se não conseguir, continuar com drops normais
            }
        }
        
        switch (blockType) {
            case 'minecraft:stone':
                drops.push(new ItemStack('minecraft:cobblestone', 1));
                break;
            case 'minecraft:deepslate':
                drops.push(new ItemStack('minecraft:cobbled_deepslate', 1));
                break;
            case 'minecraft:granite':
            case 'minecraft:diorite':
            case 'minecraft:andesite':
                drops.push(new ItemStack(blockType, 1));
                break;
            case 'minecraft:coal_ore':
            case 'minecraft:deepslate_coal_ore':
                drops.push(new ItemStack('minecraft:coal', this.applyFortune(1, config.fortune)));
                break;
            case 'minecraft:iron_ore':
            case 'minecraft:deepslate_iron_ore':
                drops.push(new ItemStack('minecraft:raw_iron', 1));
                break;
            case 'minecraft:gold_ore':
            case 'minecraft:deepslate_gold_ore':
                drops.push(new ItemStack('minecraft:raw_gold', 1));
                break;
            case 'minecraft:diamond_ore':
            case 'minecraft:deepslate_diamond_ore':
                drops.push(new ItemStack('minecraft:diamond', this.applyFortune(1, config.fortune)));
                break;
            case 'minecraft:emerald_ore':
            case 'minecraft:deepslate_emerald_ore':
                drops.push(new ItemStack('minecraft:emerald', this.applyFortune(1, config.fortune)));
                break;
            case 'minecraft:redstone_ore':
            case 'minecraft:deepslate_redstone_ore':
                drops.push(new ItemStack('minecraft:redstone', this.applyFortune(Math.floor(Math.random() * 3) + 1, config.fortune)));
                break;
            case 'minecraft:lapis_ore':
            case 'minecraft:deepslate_lapis_ore':
                drops.push(new ItemStack('minecraft:lapis_lazuli', this.applyFortune(Math.floor(Math.random() * 6) + 1, config.fortune)));
                break;
            case 'minecraft:copper_ore':
            case 'minecraft:deepslate_copper_ore':
                drops.push(new ItemStack('minecraft:raw_copper', this.applyFortune(Math.floor(Math.random() * 3) + 2, config.fortune)));
                break;
            case 'minecraft:dirt':
            case 'minecraft:grass_block':
            case 'minecraft:podzol':
            case 'minecraft:mycelium':
                drops.push(new ItemStack('minecraft:dirt', 1));
                break;
            case 'minecraft:gravel':
                // 10% chance de flint
                if (Math.random() < 0.1) {
                    drops.push(new ItemStack('minecraft:flint', 1));
                } else {
                    drops.push(new ItemStack('minecraft:gravel', 1));
                }
                break;
            case 'minecraft:sand':
            case 'minecraft:red_sand':
                drops.push(new ItemStack(blockType, 1));
                break;
            case 'minecraft:clay':
                drops.push(new ItemStack('minecraft:clay_ball', 4));
                break;
            case 'minecraft:netherrack':
            case 'minecraft:blackstone':
            case 'minecraft:basalt':
                drops.push(new ItemStack(blockType, 1));
                break;
            case 'minecraft:ancient_debris':
                drops.push(new ItemStack('minecraft:ancient_debris', 1));
                break;
            default:
                // Para outros blocos, dropar o próprio bloco
                try {
                    drops.push(new ItemStack(blockType, 1));
                } catch (error) {
                    // Se não conseguir criar o item, ignorar
                }
                break;
        }
        
        return drops;
    }

    applyFortune(baseAmount, fortuneLevel) {
        if (fortuneLevel === 0) return baseAmount;
        
        // Aplicar fortune (chance de multiplicar drops)
        const fortuneMultiplier = Math.random() < (0.33 * fortuneLevel) ? 
            Math.floor(Math.random() * fortuneLevel) + 1 : 0;
        
        return baseAmount + fortuneMultiplier;
    }
    advanceQuarryPosition(quarry) {
        const { currentX, currentY, currentZ } = quarry.progress;
        
        let startX, endX, startZ, endZ;
        
        // Usar área delimitada se definida, senão usar configuração padrão
        if (quarry.config.customArea) {
            startX = quarry.config.customArea.minX;
            endX = quarry.config.customArea.maxX;
            startZ = quarry.config.customArea.minZ;
            endZ = quarry.config.customArea.maxZ;
        } else {
            const { size } = quarry.config;
            startX = quarry.location.x - Math.floor(size / 2);
            endX = quarry.location.x + Math.floor(size / 2);
            startZ = quarry.location.z - Math.floor(size / 2);
            endZ = quarry.location.z + Math.floor(size / 2);
        }

        // Avançar X
        if (currentX < endX) {
            quarry.progress.currentX++;
        } else {
            // Resetar X e avançar Z
            quarry.progress.currentX = startX;
            if (currentZ < endZ) {
                quarry.progress.currentZ++;
            } else {
                // Resetar Z e descer Y
                quarry.progress.currentZ = startZ;
                quarry.progress.currentY--;
            }
        }
    }

    isQuarryComplete(quarry) {
        return quarry.progress.currentY <= quarry.config.depth;
    }
}

// Inicializar sistema
world.sendMessage("§8[Quarry] Carregando sistema de mineradora automática...");
const quarrySystem = new QuarrySystem();

// Exportar para debug global
globalThis.quarrySystem = quarrySystem;