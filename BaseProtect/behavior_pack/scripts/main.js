import { world, system, Player } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

// Sistema de proteção
class ProtectionSystem {
    constructor() {
        this.protectedAreas = new Map();
        this.playerTags = new Map();
        this.blockOwners = new Map();
        this.playerPositions = new Map(); // Para rastrear posições dos jogadores
        this.initialized = false;
        
        // Inicializar sistema
        this.initialize();
    }

    initialize() {
        try {
            world.sendMessage("§e[Protection] Iniciando sistema de proteção...");
            
            // Carregar dados salvos
            this.loadData();
            
            // Aguardar o mundo carregar completamente - tempo maior para estabilidade
            system.runTimeout(() => {
                this.setupEvents();
                this.startPositionMonitoring();
                this.startPeriodicSave();
                this.initialized = true;
                world.sendMessage("§a[Protection] Sistema de proteção inicializado com sucesso!");
            }, 100); // Aumentado para maior estabilidade
            
        } catch (error) {
            world.sendMessage(`§c[Protection] Erro na inicialização: ${error}`);
            // Tentar reinicializar após erro
            system.runTimeout(() => {
                this.initialize();
            }, 200);
        }
    }

    // Sistema de salvamento periódico mais robusto
    startPeriodicSave() {
        system.runInterval(() => {
            if (this.initialized) {
                try {
                    this.saveData();
                } catch (error) {
                    world.sendMessage(`§c[Protection] Erro no salvamento automático: ${error}`);
                }
            }
        }, 1200); // A cada minuto
    }

    // Sistema de persistência de dados
    saveData() {
        try {
            // Verificar se há dados para salvar
            if (this.protectedAreas.size === 0 && this.blockOwners.size === 0) {
                return; // Não salvar se não há dados
            }

            const saveData = {
                version: "1.0.0", // Versão dos dados para compatibilidade futura
                protectedAreas: Array.from(this.protectedAreas.entries()).map(([id, area]) => [
                    id, 
                    {
                        ...area,
                        members: Array.from(area.members.entries())
                    }
                ]),
                blockOwners: Array.from(this.blockOwners.entries()),
                playerTags: Array.from(this.playerTags.entries()).map(([player, tags]) => [
                    player,
                    Array.from(tags.entries())
                ]),
                timestamp: Date.now() // Para debug
            };

            // Salvar usando dynamic properties
            world.setDynamicProperty('protectionData', JSON.stringify(saveData));
            
            // Debug opcional
            // world.sendMessage(`§7[Protection] Dados salvos: ${this.protectedAreas.size} áreas, ${this.blockOwners.size} blocos`);
            
        } catch (error) {
            world.sendMessage(`§c[Protection] Erro ao salvar dados: ${error}`);
        }
    }

    loadData() {
        try {
            const savedData = world.getDynamicProperty('protectionData');
            if (!savedData) return;

            const data = JSON.parse(savedData);
            
            // Verificar versão dos dados (para futuras atualizações)
            if (data.version && data.version !== "1.0.0") {
                world.sendMessage("§e[Protection] Dados de versão diferente detectados, fazendo migração...");
            }
            
            // Restaurar áreas protegidas
            if (data.protectedAreas) {
                this.protectedAreas = new Map(data.protectedAreas.map(([id, area]) => [
                    id,
                    {
                        ...area,
                        members: new Map(area.members)
                    }
                ]));
            }

            // Restaurar donos dos blocos
            if (data.blockOwners) {
                this.blockOwners = new Map(data.blockOwners);
            }

            // Restaurar tags dos jogadores
            if (data.playerTags) {
                this.playerTags = new Map(data.playerTags.map(([player, tags]) => [
                    player,
                    new Map(tags)
                ]));
            }

            const loadTime = data.timestamp ? new Date(data.timestamp).toLocaleString() : "desconhecido";
            world.sendMessage(`§a[Protection] Dados carregados: ${this.protectedAreas.size} áreas, ${this.blockOwners.size} blocos (salvos em: ${loadTime})`);
            
        } catch (error) {
            world.sendMessage(`§c[Protection] Erro ao carregar dados: ${error}`);
            // Inicializar com dados vazios em caso de erro
            this.protectedAreas = new Map();
            this.blockOwners = new Map();
            this.playerTags = new Map();
        }
    }

    // Monitoramento de posição dos jogadores para teleporte defensivo
    startPositionMonitoring() {
        system.runInterval(() => {
            if (!this.initialized) return;

            try {
                for (const player of world.getPlayers()) {
                    if (!player.isValid()) continue;

                    const currentPos = player.location;
                    const areaId = this.getAreaAtLocation(currentPos);
                    
                    if (areaId) {
                        const area = this.protectedAreas.get(areaId);
                        const permission = this.getPlayerPermission(player.name, areaId);
                        
                        // Se não tem permissão, teleportar para fora
                        if (!permission) {
                            this.teleportPlayerOut(player, area, currentPos);
                        }
                    }
                }
            } catch (error) {
                // Silencioso para não spammar o chat
            }
        }, 20); // Verificar a cada segundo
    }

    teleportPlayerOut(player, area, currentPos) {
        try {
            // Calcular posição segura fora da área
            const safePos = this.findSafePositionOutside(area, currentPos);
            
            player.teleport(safePos);
            player.sendMessage(`§c🛡️ Você foi teleportado para fora da área protegida!`);
            player.sendMessage(`§7Área: §f${area.name} §7- Dono: §f${area.owner}`);
            
        } catch (error) {
            world.sendMessage(`§c[Error] Erro no teleporte defensivo: ${error}`);
        }
    }

    findSafePositionOutside(area, currentPos) {
        const centerX = (area.x1 + area.x2) / 2;
        const centerZ = (area.z1 + area.z2) / 2;
        const sizeX = Math.abs(area.x2 - area.x1);
        const sizeZ = Math.abs(area.z2 - area.z1);
        
        // Teleportar para fora da área com margem de segurança
        const margin = 10;
        const maxSize = Math.max(sizeX, sizeZ);
        
        // Calcular direção para sair
        const dirX = currentPos.x - centerX;
        const dirZ = currentPos.z - centerZ;
        
        let safeX, safeZ;
        
        if (Math.abs(dirX) > Math.abs(dirZ)) {
            // Sair pela lateral X
            safeX = centerX + (dirX > 0 ? maxSize/2 + margin : -maxSize/2 - margin);
            safeZ = currentPos.z;
        } else {
            // Sair pela lateral Z
            safeX = currentPos.x;
            safeZ = centerZ + (dirZ > 0 ? maxSize/2 + margin : -maxSize/2 - margin);
        }
        
        return {
            x: Math.floor(safeX),
            y: Math.max(area.y1, area.y2) + 1,
            z: Math.floor(safeZ)
        };
    }

    setupEvents() {
        try {
            // Evento de colocação do bloco - registrar dono
            if (world.afterEvents && world.afterEvents.playerPlaceBlock) {
                world.afterEvents.playerPlaceBlock.subscribe((event) => {
                    try {
                        const { player, block } = event;
                        
                        if (!player || !block) return;
                        
                        if (block.typeId === 'protection:protection_block') {
                            const blockKey = this.getBlockKey(block.location);
                            this.blockOwners.set(blockKey, player.name);
                            
                            // Salvar com delay para evitar spam
                            system.runTimeout(() => {
                                this.saveData();
                            }, 20);
                            
                            world.sendMessage(`§a[Protection] ${player.name} colocou um bloco de proteção em (${block.location.x}, ${block.location.y}, ${block.location.z})`);
                            player.sendMessage("§a✅ Bloco de proteção colocado! Clique com botão direito para configurar.");
                        }
                    } catch (error) {
                        world.sendMessage(`§c[Error] Erro no evento de colocação: ${error}`);
                    }
                });
            }

            // Evento principal - clique direito no bloco
            if (world.afterEvents && world.afterEvents.itemUse) {
                world.afterEvents.itemUse.subscribe((event) => {
                    try {
                        const { source: player } = event;
                        
                        if (!player || !player.isValid()) return;
                        
                        const blockRaycast = player.getBlockFromViewDirection();
                        if (!blockRaycast || !blockRaycast.block) return;
                        
                        const block = blockRaycast.block;
                        
                        if (block.typeId === 'protection:protection_block') {
                            const blockKey = this.getBlockKey(block.location);
                            const blockOwner = this.blockOwners.get(blockKey);
                            
                            if (!blockOwner) {
                                player.sendMessage("§c❌ Este bloco não tem dono registrado! Quebre e coloque novamente.");
                                return;
                            }
                            
                            if (blockOwner !== player.name) {
                                player.sendMessage(`§c🛡️ Este bloco pertence a §f${blockOwner}§c! Apenas o dono pode acessá-lo.`);
                                return;
                            }
                            
                            system.runTimeout(() => {
                                this.openProtectionInterface(player);
                            }, 2);
                        }
                    } catch (error) {
                        world.sendMessage(`§c[Error] Erro no evento itemUse: ${error}`);
                    }
                });
            }

            // Evento de quebrar blocos
            if (world.beforeEvents && world.beforeEvents.playerBreakBlock) {
                world.beforeEvents.playerBreakBlock.subscribe((event) => {
                    try {
                        const { player, block } = event;
                        
                        if (!player || !block) return;
                        
                        if (block.typeId === 'protection:protection_block') {
                            const blockKey = this.getBlockKey(block.location);
                            const blockOwner = this.blockOwners.get(blockKey);
                            
                            if (!blockOwner) {
                                world.sendMessage(`§e[Protection] Bloco sem dono removido`);
                                return;
                            }
                            
                            if (blockOwner !== player.name) {
                                event.cancel = true;
                                player.sendMessage(`§c🛡️ Você não pode quebrar este bloco! Ele pertence a §f${blockOwner}§c.`);
                                return;
                            }
                            
                            // Limpar dados
                            this.blockOwners.delete(blockKey);
                            const playerArea = this.findPlayerArea(player.name);
                            if (playerArea) {
                                this.protectedAreas.delete(playerArea);
                                for (const [playerName, tags] of this.playerTags) {
                                    tags.delete(playerArea);
                                }
                                player.sendMessage("§c⚠️ Área protegida removida junto com o bloco!");
                            }
                            
                            // Salvar com delay
                            system.runTimeout(() => {
                                this.saveData();
                            }, 20);
                            
                            world.sendMessage(`§c[Protection] ${player.name} removeu seu bloco de proteção`);
                            return;
                        }
                        
                        this.checkBlockPermission(event);
                    } catch (error) {
                        world.sendMessage(`§c[Error] Erro no evento de quebrar bloco: ${error}`);
                    }
                });
            }

            // Evento de colocar blocos em área protegida
            if (world.beforeEvents && world.beforeEvents.playerPlaceBlock) {
                world.beforeEvents.playerPlaceBlock.subscribe((event) => {
                    try {
                        const { player, block } = event;
                        
                        if (block && block.typeId === 'protection:protection_block') {
                            return;
                        }
                        
                        this.checkBlockPermission(event);
                    } catch (error) {
                        world.sendMessage(`§c[Error] Erro no evento de colocar bloco: ${error}`);
                    }
                });
            }

            // Comandos de debug
            if (world.beforeEvents && world.beforeEvents.chatSend) {
                world.beforeEvents.chatSend.subscribe((event) => {
                    try {
                        const message = event.message.toLowerCase();
                        
                        if (message === "!protection-debug") {
                            event.cancel = true;
                            const player = event.sender;
                            
                            player.sendMessage("§e=== DEBUG PROTECTION SYSTEM ===");
                            player.sendMessage(`§7Áreas protegidas: §f${this.protectedAreas.size}`);
                            player.sendMessage(`§7Jogadores com tags: §f${this.playerTags.size}`);
                            player.sendMessage(`§7Blocos registrados: §f${this.blockOwners.size}`);
                            player.sendMessage(`§7Sistema inicializado: §f${this.initialized}`);
                        }
                        
                        if (message === "!protection-test") {
                            event.cancel = true;
                            const player = event.sender;
                            
                            player.sendMessage("§a[Test] Abrindo interface de teste...");
                            system.runTimeout(() => {
                                this.openProtectionInterface(player);
                            }, 2);
                        }
                        
                        if (message === "!protection-save") {
                            event.cancel = true;
                            this.saveData();
                            event.sender.sendMessage("§a[Protection] Dados salvos manualmente!");
                        }
                        
                        if (message === "!protection-reload") {
                            event.cancel = true;
                            event.sender.sendMessage("§e[Protection] Recarregando sistema...");
                            this.loadData();
                            event.sender.sendMessage("§a[Protection] Sistema recarregado!");
                        }
                        
                        if (message === "!protection-clear") {
                            event.cancel = true;
                            this.protectedAreas.clear();
                            this.blockOwners.clear();
                            this.playerTags.clear();
                            this.saveData();
                            event.sender.sendMessage("§c[Protection] Todos os dados foram limpos!");
                        }
                        
                    } catch (error) {
                        world.sendMessage(`§c[Error] Erro no evento de chat: ${error}`);
                    }
                });
            }

            world.sendMessage("§a[Protection] Todos os eventos configurados!");

        } catch (error) {
            world.sendMessage(`§c[Protection] Erro ao configurar eventos: ${error}`);
        }
    }

    getBlockKey(location) {
        return `${location.x},${location.y},${location.z}`;
    }

    openProtectionInterface(player) {
        if (!player || !player.isValid()) {
            world.sendMessage("§c[Error] Jogador inválido para abrir interface");
            return;
        }

        try {
            const form = new ActionFormData()
                .title("§6§l🛡️ BLOCO DE PROTEÇÃO")
                .body("§f§lEscolha uma opção para configurar a proteção da sua área:\n\n§7Use as opções abaixo para gerenciar sua área protegida")
                .button("§2§l✅ DEFINIR ÁREA PROTEGIDA\n§7Configurar limites da área")
                .button("§3§l👥 GERENCIAR JOGADORES\n§7Adicionar/remover membros")
                .button("§e§l🚫 CONFIGURAR TELEPORTE\n§7Definir ponto de expulsão")
                .button("§4§l❌ REMOVER PROTEÇÃO\n§7Desativar proteção")
                .button("§b§lℹ️ INFORMAÇÕES DA ÁREA\n§7Ver detalhes da área");

            form.show(player).then((response) => {
                if (response.canceled) {
                    player.sendMessage("§7Interface cancelada");
                    return;
                }
                
                if (response.selection === undefined) {
                    player.sendMessage("§c[Error] Seleção inválida");
                    return;
                }

                switch (response.selection) {
                    case 0:
                        this.showAreaDefinitionForm(player);
                        break;
                    case 1:
                        this.showTagManagementForm(player);
                        break;
                    case 2:
                        this.showTeleportConfigForm(player);
                        break;
                    case 3:
                        this.removeProtection(player);
                        break;
                    case 4:
                        this.showAreaInfo(player);
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro ao mostrar interface: ${error}`);
                player.sendMessage("§cErro ao abrir interface. Tente novamente em alguns segundos.");
            });

        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar interface: ${error}`);
        }
    }

    showAreaDefinitionForm(player) {
        try {
            const form = new ModalFormData()
                .title("§6§l📍 DEFINIR ÁREA PROTEGIDA")
                .textField("§f§lCoordenada X1 (Canto 1):\n§7Digite a coordenada X do primeiro canto", "Ex: 100", "")
                .textField("§f§lCoordenada Y1 (Canto 1):\n§7Digite a coordenada Y do primeiro canto", "Ex: 64", "")
                .textField("§f§lCoordenada Z1 (Canto 1):\n§7Digite a coordenada Z do primeiro canto", "Ex: 200", "")
                .textField("§f§lCoordenada X2 (Canto 2):\n§7Digite a coordenada X do segundo canto", "Ex: 150", "")
                .textField("§f§lCoordenada Y2 (Canto 2):\n§7Digite a coordenada Y do segundo canto", "Ex: 100", "")
                .textField("§f§lCoordenada Z2 (Canto 2):\n§7Digite a coordenada Z do segundo canto", "Ex: 250", "")
                .textField("§f§lNome da Área:\n§7Digite um nome para sua área protegida", "Ex: Minha Base", "");

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) {
                    player.sendMessage("§7Formulário cancelado");
                    return;
                }

                const [x1, y1, z1, x2, y2, z2, areaName] = response.formValues;

                if (!this.validateCoordinates(x1, y1, z1, x2, y2, z2)) {
                    player.sendMessage("§c❌ Coordenadas inválidas! Use apenas números.");
                    return;
                }

                const existingArea = this.findPlayerArea(player.name);
                if (existingArea) {
                    player.sendMessage("§c❌ Você já possui uma área protegida! Remova a atual primeiro.");
                    return;
                }

                const areaId = this.createProtectedArea(player, {
                    x1: parseInt(x1), y1: parseInt(y1), z1: parseInt(z1),
                    x2: parseInt(x2), y2: parseInt(y2), z2: parseInt(z2),
                    name: areaName || "Área Protegida"
                });

                this.saveData(); // Salvar dados

                player.sendMessage(`§a✅ Área protegida criada com sucesso!`);
                player.sendMessage(`§7Nome: §f${areaName || "Área Protegida"}`);
                player.sendMessage(`§7Coordenadas: §f(${x1}, ${y1}, ${z1}) até (${x2}, ${y2}, ${z2})`);
                
                world.sendMessage(`§a[Protection] ${player.name} criou uma nova área protegida: ${areaName || "Área Protegida"}`);
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro no formulário de área: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de área: ${error}`);
        }
    }

    showTagManagementForm(player) {
        try {
            const form = new ActionFormData()
                .title("§3§l👥 GERENCIAR JOGADORES")
                .body("§f§lGerencie as permissões de acesso à sua área:\n\n§7Use as opções abaixo para controlar quem pode acessar sua área")
                .button("§2§l➕ ADICIONAR JOGADOR\n§7Permitir acesso a um jogador")
                .button("§4§l➖ REMOVER JOGADOR\n§7Remover acesso de um jogador")
                .button("§e§l📋 LISTAR JOGADORES\n§7Ver todos os membros");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === undefined) return;

                switch (response.selection) {
                    case 0:
                        this.showAddPlayerForm(player);
                        break;
                    case 1:
                        this.showRemovePlayerForm(player);
                        break;
                    case 2:
                        this.showPlayerList(player);
                        break;
                }
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro no gerenciamento de jogadores: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de gerenciamento: ${error}`);
        }
    }

    showAddPlayerForm(player) {
        try {
            const form = new ModalFormData()
                .title("§2§l➕ ADICIONAR JOGADOR")
                .textField("§f§lNome do Jogador:\n§7Digite o nome exato do jogador", "Ex: Steve", "")
                .dropdown("§f§lNível de Permissão:\n§7Escolha o tipo de acesso", ["👁️ Visitante (apenas entrar)", "🔨 Construtor (construir/quebrar)", "👑 Admin (acesso total)"], 0);

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [playerName, permissionLevel] = response.formValues;
                const permissions = ["visitor", "builder", "admin"];
                
                if (playerName && playerName.trim() !== "") {
                    this.addPlayerToArea(player, playerName.trim(), permissions[permissionLevel]);
                    this.saveData(); // Salvar dados
                    player.sendMessage(`§a✅ Jogador §f${playerName} §aadicionado com permissão de §f${permissions[permissionLevel]}§a!`);
                } else {
                    player.sendMessage("§c❌ Nome do jogador não pode estar vazio!");
                }
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro ao adicionar jogador: ${error}`);
                player.sendMessage("§c❌ Erro ao adicionar jogador. Tente novamente.");
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de adicionar jogador: ${error}`);
        }
    }

    showRemovePlayerForm(player) {
        try {
            const form = new ModalFormData()
                .title("§4§l➖ REMOVER JOGADOR")
                .textField("§f§lNome do Jogador:\n§7Digite o nome do jogador para remover", "Ex: Steve", "");

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const playerName = response.formValues[0];
                if (playerName && playerName.trim() !== "") {
                    this.removePlayerFromArea(player, playerName.trim());
                    this.saveData(); // Salvar dados
                    player.sendMessage(`§c❌ Jogador §f${playerName} §cremovido da área!`);
                } else {
                    player.sendMessage("§c❌ Nome do jogador não pode estar vazio!");
                }
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro ao remover jogador: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de remover jogador: ${error}`);
        }
    }

    showTeleportConfigForm(player) {
        const ownerArea = this.findPlayerArea(player.name);
        if (!ownerArea) {
            player.sendMessage("§c❌ Você não possui uma área protegida!");
            return;
        }

        try {
            const area = this.protectedAreas.get(ownerArea);
            const currentTp = area.expulsionPoint || { x: 0, y: 64, z: 0 };

            const form = new ModalFormData()
                .title("§e§l🚫 CONFIGURAR TELEPORTE DE EXPULSÃO")
                .textField("§f§lCoordenada X do ponto de expulsão:\n§7Para onde invasores serão teleportados", "Ex: 125", currentTp.x.toString())
                .textField("§f§lCoordenada Y do ponto de expulsão:\n§7Altura do teleporte", "Ex: 70", currentTp.y.toString())
                .textField("§f§lCoordenada Z do ponto de expulsão:\n§7Coordenada Z do teleporte", "Ex: 225", currentTp.z.toString());

            form.show(player).then((response) => {
                if (response.canceled || !response.formValues) return;

                const [tpX, tpY, tpZ] = response.formValues;

                if (!this.validateCoordinates(tpX, tpY, tpZ)) {
                    player.sendMessage("§c❌ Coordenadas de teleporte inválidas!");
                    return;
                }

                area.expulsionPoint = {
                    x: parseInt(tpX),
                    y: parseInt(tpY),
                    z: parseInt(tpZ)
                };

                this.saveData(); // Salvar dados

                player.sendMessage("§a✅ Ponto de expulsão configurado com sucesso!");
                player.sendMessage(`§7Invasores serão teleportados para: §f(${tpX}, ${tpY}, ${tpZ})`);
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro na configuração de teleporte: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de teleporte: ${error}`);
        }
    }

    validateCoordinates(...coords) {
        return coords.every(coord => {
            const num = parseFloat(coord);
            return !isNaN(num) && isFinite(num) && coord !== "" && coord !== null && coord !== undefined;
        });
    }

    createProtectedArea(owner, area) {
        const areaId = `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ownerName = owner.name;

        this.protectedAreas.set(areaId, {
            ...area,
            owner: ownerName,
            members: new Map(),
            created: new Date().toISOString(),
            expulsionPoint: null
        });

        this.addPlayerTag(ownerName, areaId, "owner");
        return areaId;
    }

    addPlayerToArea(owner, playerName, permission) {
        const ownerArea = this.findPlayerArea(owner.name);
        if (!ownerArea) {
            owner.sendMessage("§c❌ Você não possui uma área protegida!");
            return;
        }

        const area = this.protectedAreas.get(ownerArea);
        area.members.set(playerName, permission);
        this.addPlayerTag(playerName, ownerArea, permission);
    }

    removePlayerFromArea(owner, playerName) {
        const ownerArea = this.findPlayerArea(owner.name);
        if (!ownerArea) return;

        const area = this.protectedAreas.get(ownerArea);
        area.members.delete(playerName);
        this.removePlayerTag(playerName, ownerArea);
    }

    addPlayerTag(playerName, areaId, permission) {
        if (!this.playerTags.has(playerName)) {
            this.playerTags.set(playerName, new Map());
        }
        this.playerTags.get(playerName).set(areaId, permission);
    }

    removePlayerTag(playerName, areaId) {
        if (this.playerTags.has(playerName)) {
            this.playerTags.get(playerName).delete(areaId);
        }
    }

    findPlayerArea(playerName) {
        for (const [areaId, area] of this.protectedAreas) {
            if (area.owner === playerName) {
                return areaId;
            }
        }
        return null;
    }

    showPlayerList(player) {
        const ownerArea = this.findPlayerArea(player.name);
        if (!ownerArea) {
            player.sendMessage("§c❌ Você não possui uma área protegida!");
            return;
        }

        const area = this.protectedAreas.get(ownerArea);
        let membersList = "§6§l=== 📋 LISTA DE MEMBROS ===\n";
        membersList += `§f§l👑 Dono: §a${area.owner}\n\n`;
        
        if (area.members.size === 0) {
            membersList += "§7Nenhum membro adicionado.";
        } else {
            membersList += "§f§lMembros:\n";
            area.members.forEach((permission, playerName) => {
                const permissionColor = permission === "admin" ? "§c👑" : 
                                      permission === "builder" ? "§a🔨" : "§7👁️";
                membersList += `§f- §e${playerName} ${permissionColor} §7(${permission})\n`;
            });
        }

        player.sendMessage(membersList);
    }

    checkBlockPermission(event) {
        if (!event.player || !event.block) return;

        const player = event.player;
        const location = event.block.location;

        const areaId = this.getAreaAtLocation(location);
        if (!areaId) return;

        const area = this.protectedAreas.get(areaId);
        const playerPermission = this.getPlayerPermission(player.name, areaId);

        if (!playerPermission || (playerPermission === "visitor")) {
            event.cancel = true;
            player.sendMessage("§c🛡️ Você não tem permissão para fazer isso nesta área!");
            player.sendMessage(`§7Área: §f${area.name} §7- Dono: §f${area.owner}`);
        }
    }

    getAreaAtLocation(location) {
        for (const [areaId, area] of this.protectedAreas) {
            if (this.isLocationInArea(location, area)) {
                return areaId;
            }
        }
        return null;
    }

    isLocationInArea(location, area) {
        const { x, y, z } = location;
        const { x1, y1, z1, x2, y2, z2 } = area;

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2);
        const maxZ = Math.max(z1, z2);

        return x >= minX && x <= maxX &&
               y >= minY && y <= maxY &&
               z >= minZ && z <= maxZ;
    }

    getPlayerPermission(playerName, areaId) {
        if (!this.playerTags.has(playerName)) return null;
        return this.playerTags.get(playerName).get(areaId) || null;
    }

    showAreaInfo(player) {
        const areaId = this.findPlayerArea(player.name);
        if (!areaId) {
            player.sendMessage("§c❌ Você não possui uma área protegida!");
            return;
        }

        const area = this.protectedAreas.get(areaId);
        const memberCount = area.members.size;
        const expulsionPoint = area.expulsionPoint;
        
        let info = `§6§l=== ℹ️ INFORMAÇÕES DA ÁREA ===\n`;
        info += `§f§l📝 Nome: §a${area.name}\n`;
        info += `§f§l📍 Coordenadas: §e(${area.x1}, ${area.y1}, ${area.z1}) §7até §e(${area.x2}, ${area.y2}, ${area.z2})\n`;
        info += `§f§l👥 Membros: §b${memberCount}\n`;
        info += `§f§l📅 Criada em: §7${new Date(area.created).toLocaleDateString()}\n`;
        
        if (expulsionPoint) {
            info += `§f§l🚫 Ponto de Expulsão: §c(${expulsionPoint.x}, ${expulsionPoint.y}, ${expulsionPoint.z})`;
        } else {
            info += `§f§l🚫 Ponto de Expulsão: §cNão configurado`;
        }

        player.sendMessage(info);
    }

    removeProtection(player) {
        try {
            const form = new MessageFormData()
                .title("§4§l❌ REMOVER PROTEÇÃO")
                .body("§c§l⚠️ ATENÇÃO!\n\n§fTem certeza que deseja remover a proteção desta área?\n\n§7Esta ação não pode ser desfeita e todos os dados serão perdidos!")
                .button1("§4§l✅ SIM, REMOVER")
                .button2("§7§l❌ CANCELAR");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === 1) return;

                const areaId = this.findPlayerArea(player.name);
                if (areaId) {
                    const area = this.protectedAreas.get(areaId);
                    this.protectedAreas.delete(areaId);
                    
                    // Remover tags de todos os jogadores
                    for (const [playerName, tags] of this.playerTags) {
                        tags.delete(areaId);
                    }
                    
                    this.saveData(); // Salvar mudanças
                    
                    player.sendMessage("§a✅ Proteção removida com sucesso!");
                    world.sendMessage(`§c[Protection] ${player.name} removeu a proteção da área: ${area.name}`);
                } else {
                    player.sendMessage("§c❌ Você não possui uma área protegida!");
                }
            }).catch((error) => {
                world.sendMessage(`§c[Error] Erro ao remover proteção: ${error}`);
            });
        } catch (error) {
            world.sendMessage(`§c[Error] Erro ao criar formulário de remoção: ${error}`);
        }
    }
}

// Inicializar sistema quando o script carregar
world.sendMessage("§e[Protection] Carregando sistema de proteção...");
const protectionSystem = new ProtectionSystem();

// Exportar para debug global
globalThis.protectionSystem = protectionSystem;