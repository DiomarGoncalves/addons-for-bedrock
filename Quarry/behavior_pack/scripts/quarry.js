import {
  world,
  system,
  Player,
  ItemStack,
  BlockPermutation,
} from "@minecraft/server";
import {
  ActionFormData,
  ModalFormData,
  MessageFormData,
} from "@minecraft/server-ui";

class QuarrySystem {
  constructor() {
    this.quarries = new Map();
    this.initialized = false;
    this.uiBusy = new Set();

    // Minérios (modo "Minérios")
    this.oreBlocks = new Set([
      "minecraft:coal_ore",
      "minecraft:deepslate_coal_ore",
      "minecraft:iron_ore",
      "minecraft:deepslate_iron_ore",
      "minecraft:copper_ore",
      "minecraft:deepslate_copper_ore",
      "minecraft:gold_ore",
      "minecraft:deepslate_gold_ore",
      "minecraft:redstone_ore",
      "minecraft:deepslate_redstone_ore",
      "minecraft:lapis_ore",
      "minecraft:deepslate_lapis_ore",
      "minecraft:diamond_ore",
      "minecraft:deepslate_diamond_ore",
      "minecraft:emerald_ore",
      "minecraft:deepslate_emerald_ore",
      "minecraft:nether_quartz_ore",
      "minecraft:nether_gold_ore",
      "minecraft:ancient_debris",
    ]);

    // Containers válidos acima da quarry
    this.VALID_CONTAINERS = new Set([
      "minecraft:chest",
      "minecraft:trapped_chest",
      "minecraft:barrel",
      "minecraft:hopper",
      "minecraft:dispenser",
      "minecraft:dropper",
      "minecraft:shulker_box",
      "minecraft:crafter", // se estiver disponível
    ]);

    // Blocos que nunca serão minerados no modo "Tudo"
    this.NEVER_MINE = new Set([
      "minecraft:air",
      "minecraft:cave_air",
      "minecraft:void_air",
      "minecraft:bedrock",
      "minecraft:water",
      "minecraft:flowing_water",
      "minecraft:lava",
      "minecraft:flowing_lava",
      "quarry:quarry_block",
    ]);

    this.initialize();
  }

  initialize() {
    try {
      world.sendMessage("§e[Quarry] Iniciando sistema de mineradora...");

      this.loadData();
      this.setupEvents();
      this.startQuarryOperations();
      this.startPeriodicSave();

      this.initialized = true;
      world.sendMessage(
        "§a[Quarry] Sistema ativo! Agora detecta container acima e suporta modo Minérios/Tudo."
      );
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro: ${error}`);
    }
  }

  setupEvents() {
    try {
      if (world.afterEvents?.playerPlaceBlock) {
        world.afterEvents.playerPlaceBlock.subscribe((event) => {
          if (event.block.typeId === "quarry:quarry_block") {
            quarrySystem.createQuarry(event.player, event.block.location);
          }
        });
      }

      if (world.beforeEvents?.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
          const { player, block, isFirstEvent } = event;
          if (!isFirstEvent) return;

          if (block && block.typeId === "quarry:quarry_block") {
            event.cancel = true;
            system.run(() => {
              quarrySystem.openQuarryInterface(player, block.location);
            });
          }
        });
      }

      if (world.beforeEvents?.playerBreakBlock) {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
          const { block } = event;
          if (block.typeId === "quarry:quarry_block") {
            this.removeQuarry(block.location);
          }
        });
      }

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
      world.sendMessage(`§c[Quarry] Erro nos eventos: ${error}`);
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
        currentY: location.y - 1,
        minedBlocks: 0,
        created: Date.now(),
        size: 5,
        maxDepth: 100,
        speed: 60,
        mode: "ores", // "ores" | "all"
        lastMining: 0,
      });

      player.sendMessage("§a Mineradora colocada!");
      player.sendMessage("§8Clique direito para configurar");

      this.saveData();
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro ao criar mineradora: ${error}`);
    }
  }

  openQuarryInterface(player, location) {
    try {
      const quarryId = this.getLocationKey(location);
      const quarry = this.quarries.get(quarryId);

      if (!quarry) {
        player.sendMessage("§c Mineradora não encontrada!");
        return;
      }

      if (quarry.owner !== player.name) {
        player.sendMessage(
          `§c Esta mineradora pertence a §f${quarry.owner}§c!`
        );
        return;
      }

      const form = new ActionFormData()
        .title("§8 MINERADORA AUTOMÁTICA")
        .body(
          [
            `§8Status: ${quarry.active ? "§a ATIVA" : "§c PARADA"}`,
            `§8Modo: §f${quarry.mode === "ores" ? "Minérios" : "Tudo"}`,
            `§8Blocos minerados: §f${quarry.minedBlocks}`,
            `§8Profundidade atual: §f${quarry.currentY}`,
            `§8Tamanho: §f${quarry.size}x${quarry.size}`,
            `§8Profundidade máx: §f${quarry.maxDepth}`,
            `§8Velocidade: §f${this.getSpeedDescription(quarry.speed)}`,
            "",
            `§8Saída de itens: container em §f(y+1)§8 se existir; senão, §fdropa no chão§8.`,
          ].join("\n")
        )
        .button("§8 ALTERNAR MODO\n§8MinÉrios OU Tudo")
        .button("§8 CONFIGURAÇÕES\n§8Tamanho, profundidade e velocidade")
        .button(quarry.active ? "§8 PARAR MINERAÇÃO" : "§8 INICIAR MINERAÇÃO")
        .button("§4 REMOVER MINERADORA\n§8Quebrar e recuperar bloco");

      form
        .show(player)
        .then((response) => {
          if (response.canceled) return;

          switch (response.selection) {
            case 0:
              system.runTimeout(
                () => this.toggleMode(player, quarry),
                5
              );
              break;
            case 1:
              system.runTimeout(
                () => this.showConfigurationForm(player, quarry),
                5
              );
              break;
            case 2:
              system.runTimeout(
                () => this.toggleQuarryOperation(player, quarry),
                5
              );
              break;
            case 3:
              system.runTimeout(
                () => this.showRemoveConfirmation(player, quarry),
                5
              );
              break;
          }
        })
        .catch((error) => {
          player.sendMessage("§c Erro ao abrir interface. Tente novamente!");
          world.sendMessage(`§c[Quarry] Erro na interface: ${error}`);
        });
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro na interface: ${error}`);
      player.sendMessage("§c Erro ao abrir interface. Tente novamente!");
    }
  }

  toggleMode(player, quarry) {
    quarry.mode = quarry.mode === "ores" ? "all" : "ores";
    player.sendMessage(
      `§a Modo alterado para: §f${quarry.mode === "ores" ? "Minérios" : "Tudo"}`
    );
    this.saveData();
  }

  showConfigurationForm(player, quarry) {
    try {
      const form = new ModalFormData()
        .title("§8 CONFIGURAÇÕES DA MINERADORA")
        .slider(
          "§8Tamanho da Área:\n§8(3x3 até 64x64)",
          3,
          64,
          1,
          quarry.size
        )
        .slider(
          "§8Profundidade Máxima:\n§8Quantos blocos para baixo minerar",
          10,
          128,
          1,
          quarry.maxDepth
        )
        .dropdown(
          "§8Velocidade de Mineração:\n§8Velocidade de operação",
          [
            " Muito Lenta (10s)",
            " Lenta (5s)",
            " Normal (3s)",
            " Rápida (1s)",
            " Muito Rápida (0.5s)",
          ],
          this.getSpeedIndex(quarry.speed)
        );

      form.show(player).then((response) => {
        if (response.canceled) return;

        const [size, maxDepth, speedIndex] = response.formValues;

        quarry.size = Math.floor(size);
        quarry.maxDepth = Math.floor(maxDepth);
        quarry.speed = this.getSpeedFromIndex(speedIndex);

        player.sendMessage("§a Configurações atualizadas!");
        player.sendMessage(`§8Tamanho: §f${quarry.size}x${quarry.size}`);
        player.sendMessage(`§8Profundidade: §f${quarry.maxDepth} blocos`);
        player.sendMessage(
          `§8Velocidade: §f${this.getSpeedDescription(quarry.speed)}`
        );

        this.saveData();
      });
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro nas configurações: ${error}`);
    }
  }

  getSpeedDescription(speed) {
    switch (speed) {
      case 200:
        return "Muito Lenta";
      case 100:
        return "Lenta";
      case 60:
        return "Normal";
      case 20:
        return "Rápida";
      case 10:
        return "Muito Rápida";
      default:
        return "Personalizada";
    }
  }

  getSpeedIndex(speed) {
    switch (speed) {
      case 200:
        return 0;
      case 100:
        return 1;
      case 60:
        return 2;
      case 20:
        return 3;
      case 10:
        return 4;
      default:
        return 2;
    }
  }

  getSpeedFromIndex(index) {
    const speeds = [200, 100, 60, 20, 10];
    return speeds[index] || 60;
  }

  toggleQuarryOperation(player, quarry) {
    try {
      quarry.active = !quarry.active;

      if (quarry.active) {
        player.sendMessage("§a Mineradora iniciada!");
        player.sendMessage(
          `§8Modo: §f${quarry.mode === "ores" ? "Minérios" : "Tudo"}`
        );
        player.sendMessage(
          "§8Saída: container acima (se existir) ou drop no chão."
        );
      } else {
        player.sendMessage("§c⏹️ Mineradora parada!");
      }

      this.saveData();
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro ao alternar operação: ${error}`);
    }
  }

  showRemoveConfirmation(player, quarry) {
    try {
      const form = new MessageFormData()
        .title("§8 REMOVER MINERADORA")
        .body(
          "§8 ATENÇÃO!\n\n§fTem certeza que deseja remover esta mineradora?\n\n§8O bloco será devolvido ao seu inventário."
        )
        .button1("§8 SIM, REMOVER")
        .button2("§8 CANCELAR");

      form.show(player).then((response) => {
        if (response.canceled || response.selection === 1) return;

        const quarryItem = new ItemStack("quarry:quarry_block", 1);
        const inventory = player.getComponent("minecraft:inventory");
        if (inventory?.container) {
          inventory.container.addItem(quarryItem);
        }

        const block = player.dimension.getBlock(quarry.location);
        if (block) {
          block.setPermutation(BlockPermutation.resolve("minecraft:air"));
        }

        this.quarries.delete(quarry.id);
        player.sendMessage("§a Mineradora removida e devolvida ao inventário!");

        this.saveData();
      });
    } catch (error) {
      world.sendMessage(`§c[Quarry] Erro na remoção: ${error}`);
    }
  }

  startQuarryOperations() {
    system.runInterval(() => {
      if (!this.initialized) return;

      try {
        for (const [, quarry] of this.quarries) {
          if (quarry.active) {
            this.processQuarryMining(quarry);
          }
        }
      } catch {
        // silencioso
      }
    }, 20); // checa a cada ~1s; velocidade por quarry é respeitada por timestamp
  }

  processQuarryMining(quarry) {
    try {
      const now = Date.now();
      const requiredInterval = quarry.speed * 50; // ticks -> ms
      if (now - (quarry.lastMining || 0) < requiredInterval) return;
      quarry.lastMining = now;

      const minY = quarry.location.y - quarry.maxDepth;
      if (quarry.currentY < minY) {
        quarry.active = false;
        const owner = world.getPlayers().find((p) => p.name === quarry.owner);
        if (owner) {
          owner.sendMessage(
            `§e Mineradora em (${quarry.location.x}, ${quarry.location.y}, ${quarry.location.z}) terminou!`
          );
          owner.sendMessage(`§8 Total minerado: §f${quarry.minedBlocks} blocos`);
        }
        this.saveData();
        return;
      }

      const overworld = world.getDimension("overworld");
      const centerX = quarry.location.x;
      const centerZ = quarry.location.z;
      const currentY = quarry.currentY;
      const halfSize = Math.floor(quarry.size / 2);

      // Detectar container diretamente acima
      const containerComp = this.findContainerAbove(overworld, quarry.location);

      let minedThisLayer = false;

      for (let x = centerX - halfSize; x <= centerX + halfSize; x++) {
        for (let z = centerZ - halfSize; z <= centerZ + halfSize; z++) {
          const pos = { x, y: currentY, z };
          let block;
          try {
            block = overworld.getBlock(pos);
          } catch {
            continue;
          }
          if (!block) continue;

          if (!this.shouldMineBlock(block.typeId, quarry.mode)) continue;

          // Determinar drops
          const drops =
            quarry.mode === "ores"
              ? this.getBlockDrops(block.typeId)
              : [{ item: block.typeId, count: 1 }];

          // Tentar armazenar, senão dropar no chão
          let stored = false;
          if (containerComp && drops.length > 0) {
            stored = this.storeItemsInContainer(containerComp, drops);
          }

          if (!stored && drops.length > 0) {
            // Dropa no chão
            const dropPos = {
              x: pos.x + 0.5,
              y: pos.y + 0.5,
              z: pos.z + 0.5,
            };
            for (const d of drops) {
              try {
                const it = new ItemStack(d.item, d.count);
                overworld.spawnItem(it, dropPos);
              } catch {
                // ignora itens inválidos
              }
            }
          }

          // “Quebra” o bloco (vira ar)
          try {
            block.setPermutation(BlockPermutation.resolve("minecraft:air"));
          } catch {}

          quarry.minedBlocks++;
          minedThisLayer = true;

          // Particulazinha visual
          try {
            overworld.spawnParticle("minecraft:villager_happy", {
              x: pos.x + 0.5,
              y: pos.y + 0.5,
              z: pos.z + 0.5,
            });
          } catch {}
        }
      }

      if (!minedThisLayer) {
        quarry.currentY--;
      }
    } catch {
      // silencioso
    }
  }

  shouldMineBlock(typeId, mode) {
    if (mode === "ores") {
      return this.oreBlocks.has(typeId);
    }
    // modo "Tudo": ignora nunca-minerar
    if (this.NEVER_MINE.has(typeId)) return false;
    // evita minérios “lit” que podem ser estados (redstone lit)
    if (typeId === "minecraft:lit_redstone_ore") return true;
    return true;
  }

  getBlockDrops(blockType) {
    const dropMap = {
      "minecraft:coal_ore": [{ item: "minecraft:coal", count: 1 }],
      "minecraft:deepslate_coal_ore": [{ item: "minecraft:coal", count: 1 }],
      "minecraft:iron_ore": [{ item: "minecraft:raw_iron", count: 1 }],
      "minecraft:deepslate_iron_ore": [{ item: "minecraft:raw_iron", count: 1 }],
      "minecraft:copper_ore": [{ item: "minecraft:raw_copper", count: 2 }],
      "minecraft:deepslate_copper_ore": [
        { item: "minecraft:raw_copper", count: 2 },
      ],
      "minecraft:gold_ore": [{ item: "minecraft:raw_gold", count: 1 }],
      "minecraft:deepslate_gold_ore": [{ item: "minecraft:raw_gold", count: 1 }],
      "minecraft:redstone_ore": [{ item: "minecraft:redstone", count: 4 }],
      "minecraft:deepslate_redstone_ore": [
        { item: "minecraft:redstone", count: 4 },
      ],
      "minecraft:lapis_ore": [{ item: "minecraft:lapis_lazuli", count: 6 }],
      "minecraft:deepslate_lapis_ore": [
        { item: "minecraft:lapis_lazuli", count: 6 },
      ],
      "minecraft:diamond_ore": [{ item: "minecraft:diamond", count: 1 }],
      "minecraft:deepslate_diamond_ore": [
        { item: "minecraft:diamond", count: 1 },
      ],
      "minecraft:emerald_ore": [{ item: "minecraft:emerald", count: 1 }],
      "minecraft:deepslate_emerald_ore": [
        { item: "minecraft:emerald", count: 1 },
      ],
      "minecraft:nether_quartz_ore": [{ item: "minecraft:quartz", count: 1 }],
      "minecraft:nether_gold_ore": [{ item: "minecraft:gold_nugget", count: 3 }],
      "minecraft:ancient_debris": [
        { item: "minecraft:ancient_debris", count: 1 },
      ],
    };
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
        // Tentar empilhar
        for (let i = 0; i < container.size && remaining > 0; i++) {
          const existing = container.getItem(i);
          if (
            existing &&
            existing.typeId === itemData.item &&
            existing.amount < existing.maxAmount
          ) {
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
        if (remaining > 0) {
          // container lotado — falha
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  removeQuarry(location) {
    try {
      const quarryId = this.getLocationKey(location);
      this.quarries.delete(quarryId);
      this.saveData();
    } catch {
      // silencioso
    }
  }

  getLocationKey(location) {
    return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(
      location.z
    )}`;
  }

  startPeriodicSave() {
    system.runInterval(() => {
      if (this.initialized) this.saveData();
    }, 1200);
  }

  saveData() {
    try {
      const saveData = {
        version: "3.0.0",
        quarries: Array.from(this.quarries.entries()),
        timestamp: Date.now(),
      };
      world.setDynamicProperty("quarrySystemData", JSON.stringify(saveData));
    } catch {
      // silencioso
    }
  }

  loadData() {
    try {
      const savedData = world.getDynamicProperty("quarrySystemData");
      if (!savedData) return;

      const data = JSON.parse(savedData);
      if (data.quarries) {
        // migração simples: garante novos campos
        const restored = new Map();
        for (const [id, q] of data.quarries) {
          restored.set(id, {
            id: q.id ?? id,
            location: q.location,
            owner: q.owner,
            active: q.active ?? false,
            currentY: q.currentY ?? (q.location?.y ? q.location.y - 1 : 0),
            minedBlocks: q.minedBlocks ?? 0,
            created: q.created ?? Date.now(),
            size: q.size ?? 5,
            maxDepth: q.maxDepth ?? 100,
            speed: q.speed ?? 60,
            mode: q.mode ?? "ores",
            lastMining: q.lastMining ?? 0,
          });
        }
        this.quarries = restored;
      }

      const loadTime = data.timestamp
        ? new Date(data.timestamp).toLocaleString()
        : "desconhecido";
      world.sendMessage(
        `§a[Quarry] Carregado: ${this.quarries.size} mineradoras (salvo em: ${loadTime})`
      );
    } catch {
      this.quarries = new Map();
    }
  }
}

// Inicializar sistema
world.sendMessage("§e[Quarry] Carregando sistema de mineradora...");
const quarrySystem = new QuarrySystem();
globalThis.quarrySystem = quarrySystem;
