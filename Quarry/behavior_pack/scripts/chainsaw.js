import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

class SerraSystem {
  constructor() {
    this.quarries = new Map();
    this.initialized = false;
    this.uiBusy = new Set();

    // Blocos de madeira e folhas
    this.logBlocks = new Set([
      "minecraft:oak_log","minecraft:oak_wood",
      "minecraft:spruce_log","minecraft:spruce_wood",
      "minecraft:birch_log","minecraft:birch_wood",
      "minecraft:jungle_log","minecraft:jungle_wood",
      "minecraft:acacia_log","minecraft:acacia_wood",
      "minecraft:dark_oak_log","minecraft:dark_oak_wood",
      "minecraft:mangrove_log","minecraft:mangrove_wood",
      "minecraft:cherry_log","minecraft:cherry_wood",
      "minecraft:crimson_stem","minecraft:warped_stem",
      // stripped
      "minecraft:stripped_oak_log","minecraft:stripped_spruce_log",
      "minecraft:stripped_birch_log","minecraft:stripped_jungle_log",
      "minecraft:stripped_acacia_log","minecraft:stripped_dark_oak_log",
      "minecraft:stripped_mangrove_log","minecraft:stripped_cherry_log",
      // opcional
      "minecraft:bamboo_block",

      // folhas
      "minecraft:oak_leaves",
      "minecraft:spruce_leaves",
      "minecraft:birch_leaves",
      "minecraft:jungle_leaves",
      "minecraft:acacia_leaves",
      "minecraft:dark_oak_leaves",
      "minecraft:mangrove_leaves",
      "minecraft:cherry_leaves",
    ]);

    // Containers válidos acima da serra
    this.VALID_CONTAINERS = new Set([
      "minecraft:chest",
      "minecraft:trapped_chest",
      "minecraft:barrel",
      "minecraft:hopper",
      "minecraft:dispenser",
      "minecraft:dropper",
      "minecraft:shulker_box",
      "minecraft:crafter", // se disponível na tua versão
    ]);

    // Nunca cortar (segurança)
    this.NEVER_CUT = new Set([
      "minecraft:air","minecraft:cave_air","minecraft:void_air",
      "minecraft:bedrock",
      "minecraft:water","minecraft:flowing_water",
      "minecraft:lava","minecraft:flowing_lava",
      "chainsaw:chainsaw_block",
    ]);

    this.speedMap = [200, 100, 60, 20, 10]; // ticks
    this.initialize();
  }

  initialize() {
    try {
      world.sendMessage("§e[Serra] Iniciando sistema de Serra...");

      this.loadData();
      this.setupEvents();
      this.startSerraOperations();
      this.startPeriodicSave();

      this.initialized = true;
      world.sendMessage("§a[Serra] Sistema ativo! Só madeira e folhas, com opção de repetir ciclo.");
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro: ${error}`);
    }
  }

  setupEvents() {
    try {
      // Colocar bloco
      if (world.afterEvents?.playerPlaceBlock) {
        world.afterEvents.playerPlaceBlock.subscribe((event) => {
          try {
            if (!event.block) return;
            if (event.block.typeId === "chainsaw:chainsaw_block") {
              this.createSerra(event.player, event.block.location);
            }
          } catch {}
        });
      }

      // Interação (abrir UI)
      if (world.beforeEvents?.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
          try {
            const { player, block, isFirstEvent } = event;
            if (!isFirstEvent || !block) return;
            if (block.typeId === "chainsaw:chainsaw_block") {
              event.cancel = true;
              system.run(() => this.openSerraInterface(player, block.location));
            }
          } catch {}
        });
      }

      // Quebrar bloco
      if (world.beforeEvents?.playerBreakBlock) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
          try {
            const { block } = event;
            if (!block) return;
            if (block.typeId === "chainsaw:chainsaw_block") {
              this.removeSerra(block.location);
            }
          } catch {}
        });
      }

      // Chat debug
      if (world.beforeEvents?.chatSend) {
        world.beforeEvents.chatSend.subscribe((event) => {
          try {
            const message = event.message.toLowerCase();
            if (message === "!serra-debug") {
              event.cancel = true;
              const player = event.sender;
              player.sendMessage(`§6=== SERRA DEBUG ===`);
              player.sendMessage(`§8Serras registradas: §f${this.quarries.size}`);
              let activeCount = 0;
              for (const [, s] of this.quarries) if (s.active) activeCount++;
              player.sendMessage(`§8Serras ativas: §f${activeCount}`);
            }
          } catch {}
        });
      }
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro nos eventos: ${error}`);
    }
  }

  createSerra(player, location) {
    try {
      const id = this.getLocationKey(location);
      const startY = Math.floor(location.y) - 1;

      this.quarries.set(id, {
        id,
        location,
        owner: player.name,
        active: false,
        startY,             // inicio do ciclo
        currentY: startY,   // posição atual
        minedBlocks: 0,
        created: Date.now(),
        size: 5,
        maxDepth: 100,
        speed: 60,
        loop: false,        // repetir ciclo ao terminar?
        lastMining: 0,
      });

      player.sendMessage("§a Serra colocada!");
      player.sendMessage("§8Clique direito para configurar");
      this.saveData();
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro ao criar Serra: ${error}`);
    }
  }

  openSerraInterface(player, location) {
    try {
      const id = this.getLocationKey(location);
      const serra = this.quarries.get(id);

      if (!serra) {
        player.sendMessage("§c Serra não encontrada!");
        return;
      }
      if (serra.owner !== player.name) {
        player.sendMessage(`§c Esta Serra pertence a §f${serra.owner}§c!`);
        return;
      }

      const form = new ActionFormData()
        .title("§8 SERRA AUTOMÁTICA")
        .body([
          `§8Status: ${serra.active ? "§a ATIVA" : "§c PARADA"}`,
          `§8Repetir ciclo: §f${serra.loop ? "Sim" : "Não"}`,
          `§8Blocos cortados: §f${serra.minedBlocks}`,
          `§8Profundidade atual: §f${serra.currentY}`,
          `§8Tamanho: §f${serra.size}x${serra.size}`,
          `§8Profundidade máx: §f${serra.maxDepth}`,
          `§8Velocidade: §f${this.getSpeedDescription(serra.speed)}`,
          "",
          `§8Saída de itens: container em §f(y+1)§8 se existir; senão, §fdropa no chão§8.`,
        ].join("\n"))
        .button("§8 CONFIGURAÇÕES\n§8Tamanho, profundidade, velocidade, repetir")
        .button(serra.active ? "§8 PARAR SERRA" : "§8 INICIAR SERRA")
        .button("§4 REMOVER SERRA\n§8Quebrar e recuperar bloco");

      form.show(player).then((response) => {
        if (response.canceled) return;
        switch (response.selection) {
          case 0:
            system.runTimeout(() => this.showConfigurationForm(player, serra), 5);
            break;
          case 1:
            system.runTimeout(() => this.toggleSerraOperation(player, serra), 5);
            break;
          case 2:
            system.runTimeout(() => this.showRemoveConfirmation(player, serra), 5);
            break;
        }
      }).catch((e) => {
        player.sendMessage("§c Erro ao abrir interface. Tente novamente!");
        world.sendMessage(`§c[Serra] Erro na interface: ${e}`);
      });

    } catch (error) {
      world.sendMessage(`§c[Serra] Erro na interface: ${error}`);
      player.sendMessage("§c Erro ao abrir interface. Tente novamente!");
    }
  }

  showConfigurationForm(player, serra) {
    try {
      const form = new ModalFormData()
        .title("§8 CONFIGURAÇÕES DA SERRA")
        .slider("§8Tamanho da Área:\n§8(3x3 até 64x64)", 3, 64, 1, serra.size)
        .slider("§8Profundidade Máxima:\n§8Quantos blocos para baixo cortar", 1, 128, 1, serra.maxDepth)
        .dropdown("§8Velocidade de Corte:\n§8Velocidade da serra", [
          " Muito Lenta (10s)",
          " Lenta (5s)",
          " Normal (3s)",
          " Rápida (1s)",
          " Muito Rápida (0.5s)"
        ], this.getSpeedIndex(serra.speed))
        .dropdown("§8Repetir ciclo quando terminar?\n§8Recomeça do topo automaticamente", ["Não","Sim"], serra.loop ? 1 : 0);

      form.show(player).then((response) => {
        if (response.canceled) return;
        const [size, maxDepth, speedIndex, loopIdx] = response.formValues;
        serra.size = Math.floor(size);
        serra.maxDepth = Math.floor(maxDepth);
        serra.speed = this.getSpeedFromIndex(speedIndex);
        serra.loop = loopIdx === 1;

        player.sendMessage("§a Configurações atualizadas!");
        player.sendMessage(`§8Tamanho: §f${serra.size}x${serra.size}`);
        player.sendMessage(`§8Profundidade: §f${serra.maxDepth} blocos`);
        player.sendMessage(`§8Velocidade: §f${this.getSpeedDescription(serra.speed)}`);
        player.sendMessage(`§8Repetir ciclo: §f${serra.loop ? "Sim" : "Não"}`);

        this.saveData();
      });
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro nas configurações: ${error}`);
    }
  }

  getSpeedDescription(speed) {
    switch (speed) {
      case 200: return "Muito Lenta";
      case 100: return "Lenta";
      case 60:  return "Normal";
      case 20:  return "Rápida";
      case 10:  return "Muito Rápida";
      default:  return "Personalizada";
    }
  }
  getSpeedIndex(speed) {
    switch (speed) {
      case 200: return 0;
      case 100: return 1;
      case 60:  return 2;
      case 20:  return 3;
      case 10:  return 4;
      default:  return 2;
    }
  }
  getSpeedFromIndex(index) {
    return this.speedMap[index] || 60;
  }

  toggleSerraOperation(player, serra) {
    try {
      serra.active = !serra.active;
      if (serra.active) {
        player.sendMessage("§a Serra iniciada!");
        player.sendMessage(`§8Repetir ciclo: §f${serra.loop ? "Sim" : "Não"}`);
        player.sendMessage("§8Saída: container acima (se existir) ou drop no chão.");
      } else {
        player.sendMessage("§c⏹️ Serra parada!");
      }
      this.saveData();
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro ao alternar operação: ${error}`);
    }
  }

  showRemoveConfirmation(player, serra) {
    try {
      const form = new MessageFormData()
        .title("§8 REMOVER SERRA")
        .body("§8 ATENÇÃO!\n\n§fDeseja remover esta serra?\n\n§8O bloco será devolvido ao seu inventário.")
        .button1("§8 SIM, REMOVER")
        .button2("§8 CANCELAR");

      form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;

        const serraItem = new ItemStack("chainsaw:chainsaw_block", 1);
        const inventory = player.getComponent("minecraft:inventory");
        if (inventory?.container) inventory.container.addItem(serraItem);

        const block = player.dimension.getBlock(serra.location);
        if (block) block.setPermutation(BlockPermutation.resolve("minecraft:air"));

        this.quarries.delete(serra.id);
        player.sendMessage("§a Serra removida e devolvida ao inventário!");
        this.saveData();
      });
    } catch (error) {
      world.sendMessage(`§c[Serra] Erro na remoção: ${error}`);
    }
  }

  startSerraOperations() {
    system.runInterval(() => {
      if (!this.initialized) return;
      try {
        for (const [, serra] of this.quarries) {
          if (serra.active) this.processSerraMining(serra);
        }
      } catch {}
    }, 20);
  }

  processSerraMining(serra) {
    try {
      const now = Date.now();
      const required = serra.speed * 50; // ticks -> ms
      if (now - (serra.lastMining || 0) < required) return;
      serra.lastMining = now;

      const minY = serra.location.y - serra.maxDepth;

      // terminou a camada final
      if (serra.currentY < minY) {
        if (serra.loop) {
          serra.currentY = serra.startY; // reinicia ciclo do topo
          return; // próxima iteração já continua
        } else {
          serra.active = false;
          const owner = world.getPlayers().find(p => p.name === serra.owner);
          if (owner) {
            owner.sendMessage(`§e Serra em (${serra.location.x}, ${serra.location.y}, ${serra.location.z}) terminou!`);
            owner.sendMessage(`§8 Total cortado: §f${serra.minedBlocks} blocos`);
          }
          this.saveData();
          return;
        }
      }

      const overworld = world.getDimension("overworld");
      const centerX = Math.floor(serra.location.x);
      const centerZ = Math.floor(serra.location.z);
      const currentY = Math.floor(serra.currentY);
      const halfSize = Math.floor(serra.size / 2);

      // Detectar container em (y+1)
      const container = this.findContainerAbove(overworld, serra.location);

      let cutThisRound = false;

      for (let x = centerX - halfSize; x <= centerX + halfSize; x++) {
        for (let z = centerZ - halfSize; z <= centerZ + halfSize; z++) {
          const pos = { x, y: currentY, z };
          let block;
          try { block = overworld.getBlock(pos); } catch { continue; }
          if (!block) continue;

          if (!this.shouldCutBlock(block.typeId)) continue;

          // Determinar drops (madeira/folha)
          const drops = this.getBlockDrops(block.typeId);

          // Guardar no container; senão, dropar
          let stored = false;
          if (container && drops.length > 0) {
            stored = this.storeItemsInContainer(container, drops);
          }
          if (!stored && drops.length > 0) {
            const dropPos = { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
            for (const d of drops) {
              try {
                const it = new ItemStack(d.item, d.count);
                overworld.spawnItem(it, dropPos);
              } catch {}
            }
          }

          // Quebrar o bloco
          try { block.setPermutation(BlockPermutation.resolve("minecraft:air")); } catch {}

          serra.minedBlocks++;
          cutThisRound = true;

          try {
            overworld.spawnParticle("minecraft:villager_happy", {
              x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5
            });
          } catch {}
        }
      }

      if (!cutThisRound) {
        serra.currentY--;
      } else {
        this.saveData();
      }
    } catch {}
  }

  shouldCutBlock(typeId) {
    if (this.NEVER_CUT.has(typeId)) return false;
    return this.logBlocks.has(typeId);
  }

  // Drops para madeiras/folhas (com chances)
  getBlockDrops(blockType) {
    const dropMap = {
      "minecraft:oak_log": [{ item: "minecraft:oak_log", count: 1 }],
      "minecraft:spruce_log": [{ item: "minecraft:spruce_log", count: 1 }],
      "minecraft:birch_log": [{ item: "minecraft:birch_log", count: 1 }],
      "minecraft:jungle_log": [{ item: "minecraft:jungle_log", count: 1 }],
      "minecraft:acacia_log": [{ item: "minecraft:acacia_log", count: 1 }],
      "minecraft:dark_oak_log": [{ item: "minecraft:dark_oak_log", count: 1 }],
      "minecraft:mangrove_log": [{ item: "minecraft:mangrove_log", count: 1 }],
      "minecraft:cherry_log": [{ item: "minecraft:cherry_log", count: 1 }],
      "minecraft:bamboo_block": [{ item: "minecraft:bamboo_block", count: 1 }],

      "minecraft:stripped_oak_log": [{ item: "minecraft:stripped_oak_log", count: 1 }],
      "minecraft:stripped_spruce_log": [{ item: "minecraft:stripped_spruce_log", count: 1 }],
      "minecraft:stripped_birch_log": [{ item: "minecraft:stripped_birch_log", count: 1 }],
      "minecraft:stripped_jungle_log": [{ item: "minecraft:stripped_jungle_log", count: 1 }],
      "minecraft:stripped_acacia_log": [{ item: "minecraft:stripped_acacia_log", count: 1 }],
      "minecraft:stripped_dark_oak_log": [{ item: "minecraft:stripped_dark_oak_log", count: 1 }],
      "minecraft:stripped_mangrove_log": [{ item: "minecraft:stripped_mangrove_log", count: 1 }],
      "minecraft:stripped_cherry_log": [{ item: "minecraft:stripped_cherry_log", count: 1 }],
    };

    const leafDrops = {
      "minecraft:oak_leaves": "minecraft:oak_sapling",
      "minecraft:spruce_leaves": "minecraft:spruce_sapling",
      "minecraft:birch_leaves": "minecraft:birch_sapling",
      "minecraft:jungle_leaves": "minecraft:jungle_sapling",
      "minecraft:acacia_leaves": "minecraft:acacia_sapling",
      "minecraft:dark_oak_leaves": "minecraft:dark_oak_sapling",
      "minecraft:mangrove_leaves": "minecraft:mangrove_propagule",
      "minecraft:cherry_leaves": "minecraft:cherry_sapling",
    };

    // Folhas com chances
    if (leafDrops[blockType]) {
      const drops = [];
      if (Math.random() < 0.20) drops.push({ item: leafDrops[blockType], count: 1 }); // 20%
      if (Math.random() < 0.05) drops.push({ item: "minecraft:stick", count: 1 });   // 5%
      if ((blockType === "minecraft:oak_leaves" || blockType === "minecraft:dark_oak_leaves") && Math.random() < 0.01) {
        drops.push({ item: "minecraft:apple", count: 1 }); // 1%
      }
      return drops;
    }

    return dropMap[blockType] || [];
  }

  findContainerAbove(dimension, baseLocation) {
    try {
      const above = {
        x: Math.floor(baseLocation.x),
        y: Math.floor(baseLocation.y) + 1,
        z: Math.floor(baseLocation.z),
      };
      const block = dimension.getBlock(above);
      if (!block) return null;
      if (!this.VALID_CONTAINERS.has(block.typeId)) return null;
      const inv = block.getComponent("minecraft:inventory");
      return inv?.container ?? null;
    } catch {
      return null;
    }
  }

  storeItemsInContainer(container, items) {
    try {
      for (const itemData of items) {
        let remaining = itemData.count;

        // Empilhar primeiro
        for (let i = 0; i < container.size && remaining > 0; i++) {
          const existing = container.getItem(i);
          if (existing && existing.typeId === itemData.item && existing.amount < existing.maxAmount) {
            const space = existing.maxAmount - existing.amount;
            const add = Math.min(space, remaining);
            existing.amount += add;
            container.setItem(i, existing);
            remaining -= add;
          }
        }

        // Slots vazios
        while (remaining > 0 && container.emptySlotsCount > 0) {
          const stack = new ItemStack(itemData.item, Math.min(remaining, 64));
          container.addItem(stack);
          remaining -= stack.amount;
        }

        if (remaining > 0) return false; // container lotado
      }
      return true;
    } catch {
      return false;
    }
  }

  removeSerra(location) {
    try {
      const id = this.getLocationKey(location);
      this.quarries.delete(id);
      this.saveData();
    } catch {}
  }

  getLocationKey(location) {
    return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
  }

  startPeriodicSave() {
    system.runInterval(() => {
      if (this.initialized) this.saveData();
    }, 1200);
  }

  saveData() {
    try {
      const saveData = {
        version: "3.1.0", // nova versão com loop
        quarries: Array.from(this.quarries.entries()),
        timestamp: Date.now()
      };
      world.setDynamicProperty("serraSystemData", JSON.stringify(saveData));
    } catch {}
  }

  loadData() {
    try {
      const saved = world.getDynamicProperty("serraSystemData");
      if (!saved) return;
      const data = JSON.parse(saved);

      if (data.quarries) {
        const restored = new Map();
        for (const [id, s] of data.quarries) {
          const startY = s.startY ?? (s.location?.y ? Math.floor(s.location.y) - 1 : 0);
          restored.set(id, {
            id: s.id ?? id,
            location: s.location,
            owner: s.owner,
            active: s.active ?? false,
            startY,
            currentY: s.currentY ?? startY,
            minedBlocks: s.minedBlocks ?? 0,
            created: s.created ?? Date.now(),
            size: s.size ?? 5,
            maxDepth: s.maxDepth ?? 100,
            speed: s.speed ?? 60,
            loop: s.loop ?? false,
            lastMining: s.lastMining ?? 0,
          });
        }
        this.quarries = restored;
      }

      const loadTime = data.timestamp ? new Date(data.timestamp).toLocaleString() : "desconhecido";
      world.sendMessage(`§a[Serra] Carregado: ${this.quarries.size} Serras (salvo em: ${loadTime})`);
    } catch {
      this.quarries = new Map();
    }
  }
}

// Inicializar
world.sendMessage("§e[Serra] Carregando sistema de Serra...");
const serraSystem = new SerraSystem();
globalThis.serraSystem = serraSystem;
