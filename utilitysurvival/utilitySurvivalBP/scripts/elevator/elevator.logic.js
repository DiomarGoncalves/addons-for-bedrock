import { world, system } from "@minecraft/server";
import { ELEVATOR_ID, ELEVATOR_MAX_DIST } from "../config/constants.js";

// Função para verificar se há espaço seguro acima do elevador
function hasSafeHeadroom(dimension, x, y, z) {
  try {
    // O jogador precisa de 2 blocos de altura
    // Pés na posição y+1, cabeça na posição y+2
    const footBlock = dimension.getBlock({ x, y: y + 1, z });
    const headBlock = dimension.getBlock({ x, y: y + 2, z });
    
    // Se não conseguiu obter os blocos, assume que não é seguro
    if (!footBlock || !headBlock) return false;
    
    // Lista de blocos que são seguros (não sólidos ou transparentes)
    const safeBlocks = [
      "minecraft:air",
      "minecraft:cave_air",
      "minecraft:void_air",
      "minecraft:water",
      "minecraft:lava",
      "minecraft:vine",
      "minecraft:torch",
      "minecraft:redstone_torch",
      "minecraft:lever",
      "minecraft:button",
      "minecraft:pressure_plate",
      "minecraft:tripwire",
      "minecraft:flower",
      "minecraft:grass",
      "minecraft:fern",
      "minecraft:dead_bush",
      "minecraft:red_flower",
      "minecraft:yellow_flower",
      "minecraft:rail",
      "minecraft:activator_rail",
      "minecraft:detector_rail",
      "minecraft:powered_rail",
      "minecraft:cobweb"
    ];
    
    // Verifica se os blocos são seguros
    const isFootSafe = safeBlocks.includes(footBlock.typeId) || !footBlock.isSolid;
    const isHeadSafe = safeBlocks.includes(headBlock.typeId) || !headBlock.isSolid;
    
    return isFootSafe && isHeadSafe;
  } catch (error) {
    console.warn("Erro ao verificar espaço seguro:", error);
    return false;
  }
}

function isSneaking(player) {
  // Compatibilidade entre versões
  const v = player?.isSneaking;
  if (typeof v === "boolean") return v;
  if (typeof v === "function") return !!v.call(player);
  return false;
}

function tryTeleportDown(player, dim, x, y, z) {
  // O jogador está na posição y (que é block.location.y + 1)
  // Precisamos verificar blocos abaixo do bloco do elevador atual
  const currentElevatorY = y - 1; // Posição Y do bloco do elevador atual
  
  // Começa a procurar do bloco abaixo do elevador atual
  for (let i = 1; i <= ELEVATOR_MAX_DIST; i++) {
    const checkY = currentElevatorY - i;
    
    // Verifica limite mínimo da dimensão
    const minHeight = dim.getMinHeight ? dim.getMinHeight() : -64;
    if (checkY < minHeight) break;

    try {
      const block = dim.getBlock({ x, y: checkY, z });
      if (block && block.typeId === ELEVATOR_ID) {
        if (hasSafeHeadroom(dim, x, checkY, z)) {
          const targetY = checkY + 1;
          teleportPlayer(player, targetY, x, z);
          return true;
        }
      }
    } catch (error) {
      // Bloco pode não existir ou erro na obtenção
      continue;
    }
  }
  
  // Não encontrou elevador abaixo
  return false;
}

function tryTeleportUp(player, dim, x, y, z) {
  // O jogador está na posição y (que é block.location.y + 1)
  const currentElevatorY = y - 1; // Posição Y do bloco do elevador atual
  
  // Começa a procurar do bloco acima do elevador atual
  for (let i = 1; i <= ELEVATOR_MAX_DIST; i++) {
    const checkY = currentElevatorY + i;
    if (checkY > 320) break; // Limite superior

    try {
      const block = dim.getBlock({ x, y: checkY, z });
      if (block && block.typeId === ELEVATOR_ID) {
        if (hasSafeHeadroom(dim, x, checkY, z)) {
          const targetY = checkY + 1;
          teleportPlayer(player, targetY, x, z);
          return true;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  // Não encontrou elevador acima
  return false;
}

// Sistema principal do elevador - Versão Simplificada
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      if (player.hasTag("elevator_cd")) continue;

      const dim = player.dimension;
      const loc = player.location;

      const x = Math.floor(loc.x);
      const y = Math.floor(loc.y);
      const z = Math.floor(loc.z);

      // Verifica se o bloco abaixo do jogador é um elevador
      const blockUnder = dim.getBlock({ x, y: y - 1, z });
      if (!blockUnder || blockUnder.typeId !== ELEVATOR_ID) continue;

      // --- DESCER (agachando) ---
      if (isSneaking(player)) {
        // Verifica se está agachado há pelo menos 3 ticks para evitar ativação acidental
        if (!player.hasTag("elevator_sneaking")) {
          player.addTag("elevator_sneaking");
          system.runTimeout(() => {
            if (player.isValid() && player.hasTag("elevator_sneaking") && isSneaking(player)) {
              // Tenta descer
              const teleported = tryTeleportDown(player, dim, x, y, z);
              if (!teleported) {
                // Feedback sonoro se não encontrou elevador
                player.playSound("random.click", { pitch: 0.5, volume: 0.3 });
              }
            }
            if (player.isValid() && player.hasTag("elevator_sneaking")) {
              player.removeTag("elevator_sneaking");
            }
          }, 3);
        }
      } else {
        // Remove tag se não está agachando
        if (player.hasTag("elevator_sneaking")) {
          player.removeTag("elevator_sneaking");
        }
        
        // --- SUBIR (pulando) ---
        const vel = player.getVelocity();
        if (vel.y > 0.05) {
          const teleported = tryTeleportUp(player, dim, x, y, z);
          if (teleported) {
            continue; // Se teleportou, pular para próximo jogador
          }
        }
      }
    } catch (error) {
      // Silencia erros, mas registra para debug
      console.warn("Erro no elevador:", error);
    }
  }
}, 2); // Intervalo de 2 ticks (0.1 segundos)

function teleportPlayer(player, targetY, blockX, blockZ) {
  try {
    const targetLoc = { 
      x: blockX + 0.5, 
      y: targetY, 
      z: blockZ + 0.5 
    };

    player.teleport(targetLoc);
    player.playSound("random.orb", { pitch: 1.0, volume: 0.5 });

    // Efeito visual
    try {
      player.dimension.spawnParticle("minecraft:portal", {
        x: targetLoc.x,
        y: targetLoc.y + 0.5,
        z: targetLoc.z
      });
    } catch (particleError) {
      // Fallback para partícula mais simples
      try {
        player.dimension.spawnParticle("minecraft:happy_villager", targetLoc);
      } catch (e) {
        // Ignora erro de partícula
      }
    }

    // Cooldown para evitar teleportes repetidos
    player.addTag("elevator_cd");
    system.runTimeout(() => {
      if (player.isValid()) {
        player.removeTag("elevator_cd");
      }
    }, 15); // 0.75 segundos de cooldown
  } catch (teleportError) {
    console.error("Erro ao teleportar jogador:", teleportError);
  }
}

// Limpeza de tags em caso de erro
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    // Remove tag de cooldown se estiver presa por muito tempo
    if (player.hasTag("elevator_cd")) {
      system.runTimeout(() => {
        if (player.isValid() && player.hasTag("elevator_cd")) {
          player.removeTag("elevator_cd");
        }
      }, 100); // 5 segundos
    }
  }
}, 100);