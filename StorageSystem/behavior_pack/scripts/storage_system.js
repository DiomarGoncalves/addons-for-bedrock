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
                        this.useRemoteControl(player, itemStack);
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
                        player.sendMessage(`§7Controladores: §f${this.controllers.size}`);
                        player.sendMessage(`§7Redes: §f${this.networks.size}`);
                        player.sendMessage(`§7Antenas: §f${this.antennaChests.size}`);
                        player.sendMessage(`§7Controles: §f${this.remoteControls.size}`);
                    }
                    
                    if (message === "!get-remote") {
                        event.cancel = true;
                        this.giveRemoteToPlayer(event.sender);
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
            this.createRemoteControl(player, controllerId, networkId);

            player.sendMessage("§a✅ Controlador colocado!");
            player.sendMessage("§e📱 Controle remoto adicionado ao inventário!");
            
            this.scanNetwork(networkId);
            this.saveData();
            
        } catch (error) {
            world.sendMessage(`§c[Storage] Erro ao criar controlador: ${error}`);
        }
    }

    createRemoteControl(player, controllerId, networkId) {
        try {
            const remoteId = `remote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Registrar controle remoto
            this.remoteControls.set(remoteId, {
                id: remoteId,
                controllerId: controllerId,
                networkId: networkId,
                owner: player.name
            });

            // Criar item com NBT personalizado
            const remoteItem = new ItemStack('storage:remote_control', 1);
            
            // Adicionar dados customizados ao item
            remoteItem.setLore([
                `§7Vinculado ao controlador`,
                `§8ID: ${remoteId.substr(0, 8)}...`,
                `§7Dono: §f${player.name}`
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

    useRemoteControl(player, remoteItem) {
        try {
            const lore = remoteItem.getLore();
            if (!lore || lore.length < 2) {
                player.sendMessage("§c❌ Controle remoto inválido!");
                return;
            }

            // Extrair ID do controle do lore
            const idLine = lore[1];
            const remoteIdPrefix = idLine.replace('§8ID: ', '').replace('...', '');
            
            // Encontrar controle remoto correspondente
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
        // Comando de debug para dar controle remoto
        const remoteItem = new ItemStack('storage:remote_control', 1);
        remoteItem.setLore([
            `§7Controle de Debug`,
            `§8ID: debug123...`,
            `§7Dono: §f${player.name}`
        ]);

        const inventory = player.getComponent('minecraft:inventory');
        if (inventory?.container) {
            inventory.container.addItem(remoteItem);
            player.sendMessage("§a✅ Controle remoto de debug adicionado!");
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
                .body(`§7Baús: §f${network.antennaChests.size} §7| Itens: §f${network.items.size}\n§7Página: §f${page + 1}/${totalPages || 1}\n${searchTerm ? `§e🔍 "${searchTerm}"\n` : "§7Clique em um item para retirar\n"}`);

            // Botão de pesquisa
            form.button("§e🔍 PESQUISAR ITENS\n§7Busca em português e inglês");

            // Itens com ícones (simulados com emojis)
            pageItems.forEach(([itemType, count]) => {
                const itemName = this.getItemDisplayName(itemType);
                const itemIcon = this.getItemIcon(itemType);
                form.button(`${itemIcon} §f${itemName}\n§a${count}x disponível`);
            });

            // Navegação
            if (totalPages > 1) {
                if (page > 0) form.button("§7⬅️ PÁGINA ANTERIOR");
                if (page < totalPages - 1) form.button("§7➡️ PRÓXIMA PÁGINA");
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
            .textField("§fDigite o nome do item:\n§7Funciona em português e inglês\n§7Ex: diamante, diamond, ferro, iron", "Ex: diamante", "");

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
            .textField(`§7Disponível: §a${totalCount}x\n\n§fQuantidade para retirar (máx ${maxWithdraw}):`, "64", "1");

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