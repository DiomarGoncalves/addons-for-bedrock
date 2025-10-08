import { world, system, Player, ItemStack, BlockPermutation } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';

// Sistema de Armazenamento Melhorado - Com Controle Remoto
class StorageSystem {
    constructor() {
        this.controllers = new Map();
        this.networks = new Map();
        this.antennaChests = new Map();
        this.remoteControls = new Map(); // Controles remotos
        this.initialized = false;
        
        // Dicionário de traduções para pesquisa
        this.itemTranslations = this.initializeTranslations();
        
        this.initialize();
    }

    initializeTranslations() {
        return {
            // Português -> Inglês
            'diamante': 'diamond',
            'ferro': 'iron',
            'ouro': 'gold',
            'carvao': 'coal',
            'pedra': 'stone',
            'madeira': 'wood',
            'tronco': 'log',
            'tabua': 'planks',
            'vidro': 'glass',
            'tijolo': 'brick',
            'areia': 'sand',
            'cascalho': 'gravel',
            'terra': 'dirt',
            'grama': 'grass',
            'agua': 'water',
            'lava': 'lava',
            'redstone': 'redstone',
            'esmeralda': 'emerald',
            'quartzo': 'quartz',
            'obsidiana': 'obsidian',
            'bedrock': 'bedrock',
            'netherrack': 'netherrack',
            'end_stone': 'end_stone',
            'concreto': 'concrete',
            'la': 'wool',
            'terracota': 'terracotta',
            'argila': 'clay',
            'espada': 'sword',
            'picareta': 'pickaxe',
            'machado': 'axe',
            'pa': 'shovel',
            'enxada': 'hoe',
            'arco': 'bow',
            'flecha': 'arrow',
            'escudo': 'shield',
            'armadura': 'armor',
            'capacete': 'helmet',
            'peitoral': 'chestplate',
            'calcas': 'leggings',
            'botas': 'boots',
            'comida': 'food',
            'pao': 'bread',
            'maca': 'apple',
            'carne': 'meat',
            'peixe': 'fish',
            'trigo': 'wheat',
            'cenoura': 'carrot',
            'batata': 'potato',
            'beterraba': 'beetroot',
            'melancia': 'melon',
            'abobora': 'pumpkin',
            'cana': 'sugar_cane',
            'cacau': 'cocoa',
            'ovo': 'egg',
            'leite': 'milk',
            'acucar': 'sugar',
            'bolo': 'cake',
            'biscoito': 'cookie',
            'pocao': 'potion',
            'livro': 'book',
            'papel': 'paper',
            'mapa': 'map',
            'bussola': 'compass',
            'relogio': 'clock',
            'corda': 'string',
            'teia': 'web',
            'osso': 'bone',
            'polvora': 'gunpowder',
            'perola': 'pearl',
            'blaze_rod': 'blaze_rod',
            'slime': 'slime',
            'tnt': 'tnt',
            'dinamite': 'tnt',
            'pistao': 'piston',
            'alavanca': 'lever',
            'botao': 'button',
            'placa': 'sign',
            'porta': 'door',
            'portao': 'gate',
            'cerca': 'fence',
            'escada': 'stairs',
            'laje': 'slab',
            'tocha': 'torch',
            'lanterna': 'lantern',
            'fogueira': 'campfire',
            'fornalha': 'furnace',
            'bau': 'chest',
            'funil': 'hopper',
            'dispensador': 'dispenser',
            'dropper': 'dropper',
            'observador': 'observer',
            'comparador': 'comparator',
            'repetidor': 'repeater',
            'trilho': 'rail',
            'carrinho': 'minecart',
            'barco': 'boat',
            'sela': 'saddle',
            'ferradura': 'horseshoe',
            'nome': 'name_tag',
            'etiqueta': 'name_tag'
        };
    }

    initialize() {
        try {
            world.sendMessage("§6[Storage] Iniciando sistema melhorado...");
            
            this.loadData();
            this.setupEvents();
            this.startNetworkScanning();
            this.startPeriodicSave();
            
            this.initialized = true;
            world.sendMessage("§a[Storage] Sistema ativo com controle remoto!");
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro: ${error}`);
        }
    }

    setupEvents() {
        try {
            // Colocação do controlador
            if (world.afterEvents?.playerPlaceBlock) {
                world.afterEvents.playerPlaceBlock.subscribe((event) => {
                    const { player, block } = event;
                    if (block.typeId === 'storage:controller') {
                        this.createController(player, block.location);
                    }
                });
            }

            // INTERAÇÃO DIRETA - SEM PRECISAR SEGURAR ITEM
            if (world.afterEvents?.playerInteractWithBlock) {
                world.afterEvents.playerInteractWithBlock.subscribe((event) => {
                    const { player, block } = event;
                    
                    // Controlador - Abertura direta
                    if (block.typeId === 'storage:controller') {
                        this.openStorageInterface(player, block.location);
                        return;
                    }
                    
                    // Baú com antena - conectar
                    if (block.typeId === 'minecraft:chest') {
                        const heldItem = player.getComponent('minecraft:equippable')?.getEquipment('Mainhand');
                        if (heldItem?.typeId === 'storage:antenna') {
                            this.connectAntennaToChest(player, block.location);
                        }
                    }
                });
            }

            // Uso de itens - Controle remoto
            if (world.afterEvents?.itemUse) {
                world.afterEvents.itemUse.subscribe((event) => {
                    const { source: player, itemStack } = event;
                    
                    // Controle remoto
                    if (itemStack?.typeId === 'storage:remote_control') {
                        // Verificar se está segurando shift para vincular
                        if (player.isSneaking) {
                            this.linkRemoteControl(player, itemStack);
                        } else {
                            this.useRemoteControl(player, itemStack);
                        }
                        return;
                    }
                });
            }

            // Quebrar blocos
            if (world.beforeEvents?.playerBreakBlock) {
                world.beforeEvents.playerBreakBlock.subscribe((event) => {
                    const { block } = event;
                    if (block.typeId === 'storage:controller') {
                        this.removeController(block.location);
                    } else if (block.typeId === 'minecraft:chest') {
                        this.removeAntennaFromChest(block.location);
                    }
                });
            }

            // Comandos
            if (world.beforeEvents?.chatSend) {
                world.beforeEvents.chatSend.subscribe((event) => {
                    const message = event.message.toLowerCase();
                    
                    if (message === "!storage-debug") {
                        event.cancel = true;
                        const player = event.sender;
                        player.sendMessage(`§6=== STORAGE DEBUG ===`);
                        player.sendMessage(`§8Controladores: §f${this.controllers.size}`);
                        player.sendMessage(`§8Redes: §f${this.networks.size}`);
                        player.sendMessage(`§8Antenas: §f${this.antennaChests.size}`);
                        player.sendMessage(`§8Controles: §f${this.remoteControls.size}`);
                    }
                    
                    if (message === "!get-remote") {
                        event.cancel = true;
                        this.giveRemoteToPlayer(event.sender);
                    }
                    
                    if (message === "!remote-help") {
                        event.cancel = true;
                        this.showRemoteHelp(event.sender);
                    }
                });
            }

        } catch (error) {
            world.sendMessage(`§c[Storage] Erro nos eventos: ${error}`);
        }
    }

    createController(player, location) {
        try {
            const controllerId = this.getLocationKey(location);
            
            this.controllers.set(controllerId, {
                location: location,
                owner: player.name,
                network: null
            });

            const networkId = `net_${Date.now()}`;
            this.networks.set(networkId, {
                id: networkId,
                controller: controllerId,
                antennaChests: new Set(),
                items: new Map()
            });

            this.controllers.get(controllerId).network = networkId;

            // Criar controle remoto automaticamente
            this.createLinkedRemoteControl(player, controllerId, networkId);

            player.sendMessage("§a✅ Controlador colocado!");
            player.sendMessage("§e📱 Controle remoto adicionado ao inventário!");
            
            this.scanNetwork(networkId);
            this.saveData();
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao criar controlador: ${error}`);
        }
    }

    createLinkedRemoteControl(player, controllerId, networkId) {
        try {
            const remoteId = `remote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Registrar controle remoto
            this.remoteControls.set(remoteId, {
                id: remoteId,
                controllerId: controllerId,
                networkId: networkId,
                owner: player.name,
                linked: true
            });

            // Criar item com NBT personalizado
            const remoteItem = new ItemStack('storage:remote_control', 1);
            
            // Adicionar dados customizados ao item
            remoteItem.setLore([
                `§a✅ Vinculado ao controlador`,
                `§8ID: ${remoteId.substr(0, 8)}...`,
                `§8Dono: §f${player.name}`,
                `§8Shift + Clique direito para gerenciar`
            ]);

            // Dar ao jogador
            const inventory = player.getComponent('minecraft:inventory');
            if (inventory?.container) {
                inventory.container.addItem(remoteItem);
            }

        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao criar controle: ${error}`);
        }
    }

    linkRemoteControl(player, remoteItem) {
        try {
            const lore = remoteItem.getLore();
            
            // Verificar se já está vinculado
            if (lore && lore.length > 0 && lore[0].includes('✅ Vinculado')) {
                // Já vinculado - abrir menu de gerenciamento
                this.showRemoteManagementMenu(player, remoteItem);
                return;
            }
            
            // Não vinculado - mostrar controladores disponíveis
            this.showControllerLinkMenu(player, remoteItem);
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro no link: ${error}`);
        }
    }

    showControllerLinkMenu(player, remoteItem) {
        try {
            // Encontrar controladores do jogador
            const playerControllers = [];
            for (const [controllerId, controller] of this.controllers) {
                if (controller.owner === player.name) {
                    playerControllers.push({
                        id: controllerId,
                        location: controller.location,
                        network: controller.network
                    });
                }
            }
            
            if (playerControllers.length === 0) {
                player.sendMessage("§c❌ Você não possui controladores para vincular!");
                return;
            }
            
            const form = new ActionFormData()
                .title("§6§l📱 VINCULAR CONTROLE REMOTO")
                .body("§f§lEscolha um controlador para vincular:\n\n§8O controle remoto será vinculado permanentemente ao controlador escolhido");
            
            playerControllers.forEach((controller, index) => {
                const network = this.networks.get(controller.network);
                const chestCount = network ? network.antennaChests.size : 0;
                form.button(`§b📦 Controlador ${index + 1}\n§8Posição: (${controller.location.x}, ${controller.location.y}, ${controller.location.z})\n§8Baús: ${chestCount}`);
            });
            
            form.button("§c❌ Cancelar");
            
            form.show(player).then((response) => {
                if (response.canceled || response.selection === playerControllers.length) {
                    player.sendMessage("§8Vinculação cancelada");
                    return;
                }
                
                const selectedController = playerControllers[response.selection];
                this.linkRemoteToController(player, remoteItem, selectedController);
            });
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro no menu de link: ${error}`);
        }
    }

    linkRemoteToController(player, remoteItem, controller) {
        try {
            const remoteId = `remote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Registrar controle remoto
            this.remoteControls.set(remoteId, {
                id: remoteId,
                controllerId: controller.id,
                networkId: controller.network,
                owner: player.name,
                linked: true
            });
            
            // Atualizar lore do item
            remoteItem.setLore([
                `§a✅ Vinculado ao controlador`,
                `§8ID: ${remoteId.substr(0, 8)}...`,
                `§8Dono: §f${player.name}`,
                `§8Shift + Clique direito para gerenciar`
            ]);
            
            // Atualizar item no inventário
            const inventory = player.getComponent('minecraft:inventory');
            if (inventory?.container) {
                for (let i = 0; i < inventory.container.size; i++) {
                    const item = inventory.container.getItem(i);
                    if (item?.typeId === 'storage:remote_control' && 
                        (!item.getLore() || !item.getLore()[0]?.includes('✅'))) {
                        inventory.container.setItem(i, remoteItem);
                        break;
                    }
                }
            }
            
            player.sendMessage("§a✅ Controle remoto vinculado com sucesso!");
            player.sendMessage("§8Use normalmente para acessar o armazenamento");
            player.sendMessage("§8Shift + Clique direito para gerenciar controles");
            
            this.saveData();
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao vincular: ${error}`);
        }
    }

    showRemoteManagementMenu(player, remoteItem) {
        try {
            const lore = remoteItem.getLore();
            if (!lore || lore.length < 2) {
                player.sendMessage("§c❌ Controle remoto inválido!");
                return;
            }

            // Extrair ID do controle
            const idLine = lore[1];
            const remoteIdPrefix = idLine.replace('§8ID: ', '').replace('...', '');
            
            // Encontrar controle remoto
            let foundRemote = null;
            for (const [remoteId, remoteData] of this.remoteControls) {
                if (remoteId.startsWith(`remote_`) && remoteId.includes(remoteIdPrefix.substr(0, 6))) {
                    foundRemote = remoteData;
                    break;
                }
            }

            if (!foundRemote) {
                player.sendMessage("§c❌ Controle remoto não encontrado!");
                return;
            }

            // Verificar se é o dono do controlador
            const controller = this.controllers.get(foundRemote.controllerId);
            if (!controller || controller.owner !== player.name) {
                player.sendMessage("§c❌ Apenas o dono do controlador pode gerenciar controles!");
                return;
            }

            // Contar controles remotos vinculados a este controlador
            let linkedRemotes = 0;
            for (const [, remoteData] of this.remoteControls) {
                if (remoteData.controllerId === foundRemote.controllerId) {
                    linkedRemotes++;
                }
            }

            const form = new ActionFormData()
                .title("§6§l⚙️ GERENCIAR CONTROLES REMOTOS")
                .body(`§f§lControlador: §a(${controller.location.x}, ${controller.location.y}, ${controller.location.z})\n§8Controles vinculados: §f${linkedRemotes}\n\n§8Escolha uma ação:`)
                .button("§2§l➕ CRIAR NOVO CONTROLE\n§8Adicionar controle remoto extra")
                .button("§e§l📋 LISTAR CONTROLES\n§8Ver todos os controles vinculados")
                .button("§c§l🗑️ DESVINCULAR ESTE CONTROLE\n§8Remover vinculação deste controle");

            form.show(player).then((response) => {
                if (response.canceled) return;

                switch (response.selection) {
                    case 0:
                        this.createExtraRemoteControl(player, foundRemote.controllerId, foundRemote.networkId);
                        break;
                    case 1:
                        this.listLinkedRemotes(player, foundRemote.controllerId);
                        break;
                    case 2:
                        this.unlinkRemoteControl(player, remoteItem, foundRemote);
                        break;
                }
            });

        } catch (error) {
            world.sendMessage(`§c[Storage] Erro no gerenciamento: ${error}`);
        }
    }

    createExtraRemoteControl(player, controllerId, networkId) {
        try {
            const remoteId = `remote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Registrar controle remoto
            this.remoteControls.set(remoteId, {
                id: remoteId,
                controllerId: controllerId,
                networkId: networkId,
                owner: player.name,
                linked: true
            });

            // Criar item
            const remoteItem = new ItemStack('storage:remote_control', 1);
            remoteItem.setLore([
                `§a✅ Vinculado ao controlador`,
                `§8ID: ${remoteId.substr(0, 8)}...`,
                `§8Dono: §f${player.name}`,
                `§8Shift + Clique direito para gerenciar`
            ]);

            // Dar ao jogador
            const inventory = player.getComponent('minecraft:inventory');
            if (inventory?.container) {
                inventory.container.addItem(remoteItem);
                player.sendMessage("§a✅ Novo controle remoto criado!");
                player.sendMessage("§8Agora você tem um controle extra vinculado ao mesmo controlador");
            }
            
            this.saveData();
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao criar controle extra: ${error}`);
        }
    }

    listLinkedRemotes(player, controllerId) {
        try {
            const linkedRemotes = [];
            for (const [remoteId, remoteData] of this.remoteControls) {
                if (remoteData.controllerId === controllerId) {
                    linkedRemotes.push({
                        id: remoteId,
                        shortId: remoteId.substr(7, 8),
                        owner: remoteData.owner
                    });
                }
            }

            let message = `§6§l=== 📋 CONTROLES VINCULADOS ===\n`;
            message += `§8Total: §f${linkedRemotes.length} controles\n\n`;
            
            linkedRemotes.forEach((remote, index) => {
                message += `§f${index + 1}. §e${remote.shortId}... §8(${remote.owner})\n`;
            });
            
            if (linkedRemotes.length === 0) {
                message += `§8Nenhum controle vinculado.`;
            }

            player.sendMessage(message);
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao listar: ${error}`);
        }
    }

    unlinkRemoteControl(player, remoteItem, remoteData) {
        try {
            const form = new MessageFormData()
                .title("§c§l🗑️ DESVINCULAR CONTROLE")
                .body("§c§l⚠️ ATENÇÃO!\n\n§fTem certeza que deseja desvincular este controle remoto?\n\n§8O controle se tornará um item normal e precisará ser vinculado novamente para funcionar.")
                .button1("§c§l✅ SIM, DESVINCULAR")
                .button2("§8§l❌ CANCELAR");

            form.show(player).then((response) => {
                if (response.canceled || response.selection === 1) return;

                // Remover do registro
                for (const [remoteId, data] of this.remoteControls) {
                    if (data.controllerId === remoteData.controllerId && 
                        data.owner === remoteData.owner &&
                        remoteId.includes(remoteItem.getLore()[1].replace('§8ID: ', '').replace('...', '').substr(0, 6))) {
                        this.remoteControls.delete(remoteId);
                        break;
                    }
                }

                // Atualizar item para não vinculado
                remoteItem.setLore([
                    `§8❌ Não vinculado`,
                    `§8Shift + Clique direito para vincular`
                ]);

                // Atualizar no inventário
                const inventory = player.getComponent('minecraft:inventory');
                if (inventory?.container) {
                    for (let i = 0; i < inventory.container.size; i++) {
                        const item = inventory.container.getItem(i);
                        if (item?.typeId === 'storage:remote_control' && 
                            item.getLore()?.[1]?.includes(remoteItem.getLore()[1].replace('§8ID: ', '').replace('...', '').substr(0, 6))) {
                            inventory.container.setItem(i, remoteItem);
                            break;
                        }
                    }
                }

                player.sendMessage("§a✅ Controle remoto desvinculado!");
                player.sendMessage("§8Use Shift + Clique direito para vincular novamente");
                
                this.saveData();
            });
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao desvincular: ${error}`);
        }
    }

    showRemoteHelp(player) {
        const helpText = `§6§l=== 📱 AJUDA - CONTROLE REMOTO ===

§f§l📋 Como usar:
§81. §eCrafte §8um controle remoto (precisa de antena)
§82. §eShift + Clique direito §8para vincular a um controlador
§83. §eClique direito normal §8para acessar o armazenamento

§f§l⚙️ Gerenciamento (apenas donos):
§8• §eShift + Clique direito §8em controle vinculado
§8• §aCriar controles extras §8para o mesmo controlador
§8• §cDesvincular controles §8desnecessários
§8• §eListar todos §8os controles vinculados

§f§l🔧 Recipe do Controle:
§8G G    §8(G = Vidro)
§8RAR    §8(R = Redstone, A = Antena)
§8 I     §8(I = Ferro)

§f§l💡 Dicas:
§8• Controles vinculados funcionam à distância
§8• Apenas o dono do controlador pode gerenciar
§8• Controles não vinculados precisam ser configurados`;

        player.sendMessage(helpText);
    }

    useRemoteControl(player, remoteItem) {
        try {
            const lore = remoteItem.getLore();
            if (!lore || lore.length < 2 || !lore[0].includes('✅ Vinculado')) {
                player.sendMessage("§c❌ Controle remoto inválido!");
                player.sendMessage("§8Use Shift + Clique direito para vincular");
                return;
            }

            // Extrair ID do controle do lore
            const idLine = lore[1];
            const remoteIdPrefix = idLine.replace('§8ID: ', '').replace('...', '');
            
            // Encontrar controle remoto correspondente
            let foundRemote = null;
            for (const [remoteId, remoteData] of this.remoteControls) {
                if (remoteId.startsWith(`remote_`) && remoteId.includes(remoteIdPrefix.substr(0, 6)) && remoteData.linked) {
                    foundRemote = remoteData;
                    break;
                }
            }

            if (!foundRemote) {
                player.sendMessage("§c❌ Controle remoto não encontrado!");
                player.sendMessage("§8Use Shift + Clique direito para vincular novamente");
                return;
            }

            // Verificar se o controlador ainda existe
            const controller = this.controllers.get(foundRemote.controllerId);
            if (!controller) {
                player.sendMessage("§c❌ Controlador não encontrado!");
                return;
            }

            const network = this.networks.get(foundRemote.networkId);
            if (!network) {
                player.sendMessage("§c❌ Rede não encontrada!");
                return;
            }

            // Abrir interface remotamente
            player.sendMessage("§a📱 Acessando armazenamento remotamente...");
            this.scanNetwork(foundRemote.networkId);
            this.showStorageInterface(player, network);

        } catch (error) {
            world.sendMessage(`§c[Storage] Erro no controle remoto: ${error}`);
        }
    }

    giveRemoteToPlayer(player) {
        // Comando de debug para dar controle remoto não vinculado
        const remoteItem = new ItemStack('storage:remote_control', 1);
        remoteItem.setLore([
            `§8❌ Não vinculado`,
            `§8Shift + Clique direito para vincular`
        ]);

        const inventory = player.getComponent('minecraft:inventory');
        if (inventory?.container) {
            inventory.container.addItem(remoteItem);
            player.sendMessage("§a✅ Controle remoto não vinculado adicionado!");
            player.sendMessage("§8Use Shift + Clique direito para vincular a um controlador");
        }
    }

    connectAntennaToChest(player, chestLocation) {
        try {
            const chestKey = this.getLocationKey(chestLocation);
            
            if (this.antennaChests.has(chestKey)) {
                player.sendMessage("§c❌ Baú já tem antena!");
                return;
            }

            const nearestController = this.findNearestController(chestLocation);
            if (!nearestController) {
                player.sendMessage("§c❌ Nenhum controlador próximo!");
                return;
            }

            const controller = this.controllers.get(nearestController);
            const network = this.networks.get(controller.network);
            
            if (network) {
                this.antennaChests.set(chestKey, {
                    location: chestLocation,
                    networkId: controller.network
                });
                
                network.antennaChests.add(chestKey);
                this.consumeAntennaFromPlayer(player);
                
                player.sendMessage("§a✅ Antena conectada!");
                
                this.scanNetwork(controller.network);
                this.saveData();
            }

        } catch (error) {
            world.sendMessage(`§c[Storage] Erro na antena: ${error}`);
        }
    }

    openStorageInterface(player, controllerLocation) {
        try {
            const controllerId = this.getLocationKey(controllerLocation);
            const controller = this.controllers.get(controllerId);
            
            if (!controller) {
                player.sendMessage("§c❌ Controlador não encontrado!");
                return;
            }

            const network = this.networks.get(controller.network);
            if (!network) {
                player.sendMessage("§c❌ Rede não encontrada!");
                return;
            }

            this.scanNetwork(controller.network);
            this.showStorageInterface(player, network);
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro na interface: ${error}`);
        }
    }

    showStorageInterface(player, network, searchTerm = "", page = 0) {
        try {
            const itemsPerPage = 28; // Reduzido para acomodar texturas
            let items = Array.from(network.items.entries());
            
            // Pesquisa multilíngue melhorada
            if (searchTerm) {
                items = items.filter(([itemType]) => {
                    const searchLower = searchTerm.toLowerCase();
                    const itemName = this.getItemDisplayName(itemType).toLowerCase();
                    const itemId = itemType.toLowerCase();
                    
                    // Buscar por nome em inglês
                    if (itemName.includes(searchLower) || itemId.includes(searchLower)) {
                        return true;
                    }
                    
                    // Buscar por traduções em português
                    for (const [ptTerm, enTerm] of Object.entries(this.itemTranslations)) {
                        if (ptTerm.includes(searchLower) && (itemId.includes(enTerm) || itemName.includes(enTerm))) {
                            return true;
                        }
                    }
                    
                    return false;
                });
            }
            
            const totalPages = Math.ceil(items.length / itemsPerPage);
            const startIndex = page * itemsPerPage;
            const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

            const form = new ActionFormData()
                .title("§6§l📦 ARMAZENAMENTO INTELIGENTE")
                .body(`§8Baús: §f${network.antennaChests.size} §8| Itens: §f${network.items.size}\n§8Página: §f${page + 1}/${totalPages || 1}\n${searchTerm ? `§e🔍 "${searchTerm}"\n` : "§8Clique em um item para retirar\n"}`);

            // Botão de pesquisa
            form.button("§e🔍 PESQUISAR ITENS\n§8Busca em português e inglês");

            // Itens com ícones (simulados com emojis)
            pageItems.forEach(([itemType, count]) => {
                const itemName = this.getItemDisplayName(itemType);
                const itemIcon = this.getItemIcon(itemType);
                form.button(`${itemIcon} §f${itemName}\n§a${count}x disponível`);
            });

            // Navegação
            if (totalPages > 1) {
                if (page > 0) form.button("§8⬅️ PÁGINA ANTERIOR");
                if (page < totalPages - 1) form.button("§8➡️ PRÓXIMA PÁGINA");
            }

            if (searchTerm) form.button("§c❌ LIMPAR PESQUISA");

            form.show(player).then((response) => {
                if (response.canceled) return;

                let selection = response.selection;
                
                // Pesquisa
                if (selection === 0) {
                    this.showSearchForm(player, network, page);
                    return;
                }
                selection--;

                // Itens
                if (selection < pageItems.length) {
                    const [itemType, count] = pageItems[selection];
                    this.showWithdrawForm(player, network, itemType, count, searchTerm, page);
                    return;
                }
                selection -= pageItems.length;

                // Navegação
                if (totalPages > 1) {
                    if (page > 0) {
                        if (selection === 0) {
                            this.showStorageInterface(player, network, searchTerm, page - 1);
                            return;
                        }
                        selection--;
                    }
                    
                    if (page < totalPages - 1) {
                        if (selection === 0) {
                            this.showStorageInterface(player, network, searchTerm, page + 1);
                            return;
                        }
                        selection--;
                    }
                }

                // Limpar pesquisa
                if (searchTerm && selection === 0) {
                    this.showStorageInterface(player, network, "", 0);
                }
            });
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro na interface: ${error}`);
        }
    }

    getItemIcon(itemType) {
        // Mapeamento de ícones para diferentes tipos de itens
        const iconMap = {
            // Minerais
            'diamond': '💎',
            'iron': '⚙️',
            'gold': '🟨',
            'coal': '⚫',
            'emerald': '💚',
            'redstone': '🔴',
            'lapis': '🔵',
            'quartz': '⚪',
            
            // Blocos
            'stone': '🗿',
            'dirt': '🟫',
            'grass': '🟩',
            'wood': '🟫',
            'log': '🪵',
            'planks': '📦',
            'glass': '🔳',
            'brick': '🧱',
            'concrete': '⬜',
            'wool': '🧶',
            'sand': '🟨',
            'gravel': '⚫',
            
            // Ferramentas
            'sword': '⚔️',
            'pickaxe': '⛏️',
            'axe': '🪓',
            'shovel': '🥄',
            'hoe': '🔨',
            'bow': '🏹',
            'shield': '🛡️',
            
            // Armaduras
            'helmet': '⛑️',
            'chestplate': '🦺',
            'leggings': '👖',
            'boots': '👢',
            
            // Comida
            'bread': '🍞',
            'apple': '🍎',
            'meat': '🥩',
            'fish': '🐟',
            'carrot': '🥕',
            'potato': '🥔',
            'wheat': '🌾',
            'egg': '🥚',
            'milk': '🥛',
            'cake': '🎂',
            
            // Outros
            'book': '📚',
            'paper': '📄',
            'string': '🧵',
            'bone': '🦴',
            'arrow': '🏹',
            'torch': '🕯️',
            'chest': '📦',
            'tnt': '🧨',
            'door': '🚪',
            'bed': '🛏️'
        };

        // Buscar ícone baseado no tipo do item
        for (const [key, icon] of Object.entries(iconMap)) {
            if (itemType.toLowerCase().includes(key)) {
                return icon;
            }
        }

        // Ícone padrão
        return '📦';
    }

    showSearchForm(player, network, currentPage) {
        const form = new ModalFormData()
            .title("§e🔍 PESQUISA INTELIGENTE")
            .textField("§fDigite o nome do item:\n§8Funciona em português e inglês\n§8Ex: diamante, diamond, ferro, iron", "Ex: diamante", "");

        form.show(player).then((response) => {
            if (response.canceled) {
                this.showStorageInterface(player, network, "", currentPage);
                return;
            }

            const searchTerm = response.formValues[0].trim();
            this.showStorageInterface(player, network, searchTerm, 0);
        });
    }

    showWithdrawForm(player, network, itemType, totalCount, searchTerm, page) {
        const itemName = this.getItemDisplayName(itemType);
        const itemIcon = this.getItemIcon(itemType);
        const maxWithdraw = Math.min(totalCount, 64);
        
        const form = new ModalFormData()
            .title(`${itemIcon} §f${itemName}`)
            .textField(`§8Disponível: §a${totalCount}x\n\n§fQuantidade para retirar (máx ${maxWithdraw}):`, "64", "1");

        form.show(player).then((response) => {
            if (response.canceled) {
                this.showStorageInterface(player, network, searchTerm, page);
                return;
            }

            const requestedAmount = parseInt(response.formValues[0]);
            
            if (isNaN(requestedAmount) || requestedAmount <= 0 || requestedAmount > maxWithdraw) {
                player.sendMessage("§c❌ Quantidade inválida!");
                this.showStorageInterface(player, network, searchTerm, page);
                return;
            }

            const success = this.withdrawItems(player, network, itemType, requestedAmount);
            if (success) {
                player.sendMessage(`§a✅ ${requestedAmount}x ${itemName} retirado!`);
                this.scanNetwork(network.id);
                this.showStorageInterface(player, network, searchTerm, page);
            } else {
                player.sendMessage("§c❌ Erro ao retirar!");
                this.showStorageInterface(player, network, searchTerm, page);
            }
        });
    }

    withdrawItems(player, network, itemType, amount) {
        try {
            let remaining = amount;
            
            for (const chestKey of network.antennaChests) {
                if (remaining <= 0) break;
                
                const antennaData = this.antennaChests.get(chestKey);
                if (!antennaData) continue;
                
                const block = world.getDimension('overworld').getBlock(antennaData.location);
                if (!block || block.typeId !== 'minecraft:chest') continue;
                
                const inventory = block.getComponent('minecraft:inventory');
                if (!inventory?.container) continue;
                
                const container = inventory.container;
                
                for (let i = 0; i < container.size && remaining > 0; i++) {
                    const item = container.getItem(i);
                    if (!item || item.typeId !== itemType) continue;
                    
                    const takeAmount = Math.min(remaining, item.amount);
                    remaining -= takeAmount;
                    
                    const giveItem = new ItemStack(itemType, takeAmount);
                    const playerInventory = player.getComponent('minecraft:inventory');
                    if (playerInventory?.container) {
                        playerInventory.container.addItem(giveItem);
                    }
                    
                    if (takeAmount >= item.amount) {
                        container.setItem(i, undefined);
                    } else {
                        const newItem = item.clone();
                        newItem.amount -= takeAmount;
                        container.setItem(i, newItem);
                    }
                }
            }
            
            return remaining === 0;
        } catch (error) {
            return false;
        }
    }

    scanNetwork(networkId) {
        try {
            const network = this.networks.get(networkId);
            if (!network) return;

            network.items.clear();

            for (const chestKey of network.antennaChests) {
                const antennaData = this.antennaChests.get(chestKey);
                if (!antennaData) continue;
                
                const block = world.getDimension('overworld').getBlock(antennaData.location);
                if (!block || block.typeId !== 'minecraft:chest') continue;

                const inventory = block.getComponent('minecraft:inventory');
                if (!inventory?.container) continue;

                for (let i = 0; i < inventory.container.size; i++) {
                    const item = inventory.container.getItem(i);
                    if (!item) continue;

                    const currentCount = network.items.get(item.typeId) || 0;
                    network.items.set(item.typeId, currentCount + item.amount);
                }
            }
        } catch (error) {
            // Silencioso
        }
    }

    consumeAntennaFromPlayer(player) {
        try {
            const inventory = player.getComponent('minecraft:inventory');
            if (!inventory?.container) return;
            
            for (let i = 0; i < inventory.container.size; i++) {
                const item = inventory.container.getItem(i);
                if (item?.typeId === 'storage:antenna') {
                    if (item.amount > 1) {
                        const newItem = item.clone();
                        newItem.amount -= 1;
                        inventory.container.setItem(i, newItem);
                    } else {
                        inventory.container.setItem(i, undefined);
                    }
                    return;
                }
            }
        } catch (error) {
            // Silencioso
        }
    }

    findNearestController(location, maxDistance = 50) {
        let nearest = null;
        let minDistance = maxDistance;

        for (const [controllerId, controller] of this.controllers) {
            const distance = this.getDistance(location, controller.location);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = controllerId;
            }
        }

        return nearest;
    }

    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    removeAntennaFromChest(chestLocation) {
        try {
            const chestKey = this.getLocationKey(chestLocation);
            const antennaData = this.antennaChests.get(chestKey);
            
            if (antennaData) {
                const network = this.networks.get(antennaData.networkId);
                if (network) {
                    network.antennaChests.delete(chestKey);
                }
                
                this.antennaChests.delete(chestKey);
                
                const dimension = world.getDimension('overworld');
                const dropLocation = {
                    x: chestLocation.x + 0.5,
                    y: chestLocation.y + 1,
                    z: chestLocation.z + 0.5
                };
                
                dimension.spawnItem(new ItemStack('storage:antenna', 1), dropLocation);
                this.saveData();
            }
        } catch (error) {
            // Silencioso
        }
    }

    removeController(location) {
        try {
            const controllerId = this.getLocationKey(location);
            const controller = this.controllers.get(controllerId);
            
            if (controller?.network) {
                const network = this.networks.get(controller.network);
                if (network) {
                    for (const chestKey of network.antennaChests) {
                        this.antennaChests.delete(chestKey);
                    }
                }
                this.networks.delete(controller.network);
                
                // Remover controles remotos vinculados
                for (const [remoteId, remoteData] of this.remoteControls) {
                    if (remoteData.controllerId === controllerId) {
                        this.remoteControls.delete(remoteId);
                    }
                }
            }
            
            this.controllers.delete(controllerId);
            this.saveData();
            
        } catch (error) {
            // Silencioso
        }
    }

    getItemDisplayName(itemType) {
        const name = itemType.replace('minecraft:', '').replace(/_/g, ' ');
        return name.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getLocationKey(location) {
        return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
    }

    startNetworkScanning() {
        system.runInterval(() => {
            if (!this.initialized) return;
            
            for (const [networkId] of this.networks) {
                this.scanNetwork(networkId);
            }
        }, 1200);
    }

    startPeriodicSave() {
        system.runInterval(() => {
            if (this.initialized) {
                this.saveData();
            }
        }, 2400);
    }

    saveData() {
        try {
            const saveData = {
                controllers: Array.from(this.controllers.entries()),
                networks: Array.from(this.networks.entries()).map(([id, network]) => [
                    id,
                    {
                        ...network,
                        antennaChests: Array.from(network.antennaChests),
                        items: Array.from(network.items.entries())
                    }
                ]),
                antennaChests: Array.from(this.antennaChests.entries()),
                remoteControls: Array.from(this.remoteControls.entries())
            };

            world.setDynamicProperty('storageSystemData', JSON.stringify(saveData));
        } catch (error) {
            // Silencioso
        }
    }

    loadData() {
        try {
            const savedData = world.getDynamicProperty('storageSystemData');
            if (!savedData) return;

            const data = JSON.parse(savedData);
            
            if (data.controllers) {
                this.controllers = new Map(data.controllers);
            }

            if (data.networks) {
                this.networks = new Map(data.networks.map(([id, network]) => [
                    id,
                    {
                        ...network,
                        antennaChests: new Set(network.antennaChests || []),
                        items: new Map(network.items || [])
                    }
                ]));
            }

            if (data.antennaChests) {
                this.antennaChests = new Map(data.antennaChests);
            }

            if (data.remoteControls) {
                this.remoteControls = new Map(data.remoteControls);
            }

            world.sendMessage(`§a[Storage] Carregado: ${this.controllers.size} controladores, ${this.remoteControls.size} controles`);
        } catch (error) {
            this.controllers = new Map();
            this.networks = new Map();
            this.antennaChests = new Map();
            this.remoteControls = new Map();
        }
    }
}

// Inicializar
world.sendMessage("§6[Storage] Carregando sistema melhorado...");
const storageSystem = new StorageSystem();
globalThis.storageSystem = storageSystem;