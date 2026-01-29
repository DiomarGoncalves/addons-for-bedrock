import { world, system, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// =====================
// Configurações & Enums
// =====================
const CONFIG_ITEM = "builder:config";
const MAX_SIDE = 64;
const MAX_BLOCKS = 32768;
const BATCH_SIZE = 250;

function getGameModeSafe(player) {
  try {
    // algumas versões expõem getGameMode()
    if (typeof player.getGameMode === "function") return player.getGameMode();
  } catch (_) {}
  try {
    if (player.gameMode) return player.gameMode;
  } catch (_) {}
  return "unknown";
}

function isCreativeLike(mode) {
  return mode === "creative" || mode === "spectator";
}


const BuildMode = {
  NORMAL: "normal",
  LINE: "line",
  WALL: "wall",
  FLOOR: "floor",
  DIAGONAL: "diagonal",
  BOX: "box",
  CIRCLE: "circle",
  CYLINDER: "cylinder",
  SPHERE: "sphere"
};

// =====================
// Estado Global
// =====================
const playerStates = new Map();

function getState(p) {
  if (!playerStates.has(p.id)) {
    playerStates.set(p.id, {
      mode: BuildMode.FLOOR,
      hollow: false,
      onlyAir: true,
      mirror: { enabled: false, axis: "x", pos: 0 },
      array: { enabled: false, count: 1, offset: { x: 5, y: 0, z: 0 } },
      randomizer: { enabled: false, blocks: [] },
      // Estado de seleção clássica
      active: false, // Se o ponto A está marcado
      startPos: null,
      face: null,
      materialId: null,
      dimension: null
    });
  }
  return playerStates.get(p.id);
}

function hasConfigItem(player) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (item && item.typeId === CONFIG_ITEM) return true;
    }

    // Verificar também a mão secundária (offhand)
    const eq = player.getComponent("minecraft:equippable");
    if (eq) {
      const offhand = eq.getEquipment("Offhand");
      if (offhand && offhand.typeId === CONFIG_ITEM) return true;
    }
  } catch (e) { }
  return false;
}


function isValidPos(pos) {
  return pos && pos.y >= -64 && pos.y <= 320;
}


// =====================
// Motor de Geometria
// =====================
const Geometry = {
  line(a, b) {
    const pos = [];
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), dz = Math.abs(b.z - a.z);
    const max = Math.max(dx, dy, dz);
    for (let i = 0; i <= max; i++) {
      const t = i / (max || 1);
      pos.push({
        x: Math.round(a.x + (b.x - a.x) * t),
        y: Math.round(a.y + (b.y - a.y) * t),
        z: Math.round(a.z + (b.z - a.z) * t)
      });
    }
    return pos;
  },

  box(a, b, hollow) {
    const pos = [];
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (hollow) {
            const isEdge = x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ;
            if (isEdge) pos.push({ x, y, z });
          } else {
            pos.push({ x, y, z });
          }
        }
      }
    }
    return pos;
  },

  wall(a, b, face) {
    const pos = [];
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (face === "East" || face === "West") {
            if (x === a.x) pos.push({ x, y, z });
          } else if (face === "North" || face === "South") {
            if (z === a.z) pos.push({ x, y, z });
          } else {
            // Se for Up/Down ou face não identificada, preenche o retângulo no plano atual
            if (y === a.y) pos.push({ x, y, z });
          }
        }
      }
    }
    return pos;
  },

  floor(a, b) {
    const pos = [];
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++)
        pos.push({ x, y: a.y, z });
    return pos;
  },

  circle(a, b, hollow) {
    const pos = [];
    const radius = Math.floor(Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2)));
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (hollow ? (d >= radius - 0.8 && d <= radius + 0.5) : (d <= radius + 0.5)) {
          pos.push({ x: a.x + x, y: a.y, z: a.z + z });
        }
      }
    }
    return pos;
  },

  cylinder(a, b, hollow) {
    const pos = [];
    const radius = Math.floor(Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2)));
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    for (let y = minY; y <= maxY; y++) {
      const isCap = y === minY || y === maxY;
      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          const d = Math.sqrt(x * x + z * z);
          if (hollow) {
            const isEdge = d >= radius - 0.8 && d <= radius + 0.5;
            if (isEdge || (isCap && d <= radius + 0.5)) {
              pos.push({ x: a.x + x, y, z: a.z + z });
            }
          } else {
            if (d <= radius + 0.5) {
              pos.push({ x: a.x + x, y, z: a.z + z });
            }
          }
        }
      }
    }
    return pos;
  },

  sphere(a, b, hollow) {
    const pos = [];
    const radius = Math.floor(Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2) + Math.pow(b.z - a.z, 2)));
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const d = Math.sqrt(x * x + y * y + z * z);
          if (hollow ? (d >= radius - 1 && d <= radius) : (d <= radius)) {
            pos.push({ x: a.x + x, y: a.y + y, z: a.z + z });
          }
        }
      }
    }
    return pos;
  }
};


// =====================
// Build Engine
// =====================
function applyModifiers(pState, positions) {
  let result = [...positions];
  if (pState.mirror.enabled) {
    const mirrored = [];
    const axis = pState.mirror.axis;
    const pivot = pState.mirror.pos;
    for (const p of result) {
      const m = { ...p };
      m[axis] = pivot - (p[axis] - pivot);
      mirrored.push(m);
    }
    result = [...result, ...mirrored];
  }
  return result;
}

function solveBuild(player, positions, materialId) {
  const s = getState(player);

  const uniquePos = Array.from(new Set(positions.map(p => `${p.x},${p.y},${p.z}`)))
    .map(str => { const [x, y, z] = str.split(","); return { x: parseInt(x), y: parseInt(y), z: parseInt(z) } });

  if (uniquePos.length > MAX_BLOCKS) {
    player.onScreenDisplay.setActionBar("§cLimite excedido!");
    return;
  }

  let idx = 0;
  const task = system.runInterval(() => {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) { system.clearRun(task); return; }

    let placedInTick = 0;
    while (placedInTick < BATCH_SIZE && idx < uniquePos.length) {
      const pos = uniquePos[idx++];
      if (!isValidPos(pos)) continue;

      try {
        const block = player.dimension.getBlock(pos);
        if (!block) continue;

        if (!s.onlyAir || block.typeId === "minecraft:air") {
          // Consumo de itens (Survival)
          const gm = getGameModeSafe(player);
          if (!isCreativeLike(gm)) {
            let found = false;
            for (let i = 0; i < inventory.size; i++) {
              const it = inventory.getItem(i);
              if (it && it.typeId === materialId) {
                const newAmount = it.amount - 1;
                if (newAmount > 0) {
                  it.amount = newAmount;
                  inventory.setItem(i, it);
                } else {
                  inventory.setItem(i, undefined);
                }
                found = true;
                break;
              }
            }
            if (!found) {
              player.onScreenDisplay.setActionBar("§cSem blocos no inventário para completar!");
              system.clearRun(task);
              return;
            }
          }

          // Substituição com Drop
          if (block.typeId !== "minecraft:air") {
            // Quando não é ar, usamos comandos para garantir que "destroy" drope os itens.
            // Removido o '0' para compatibilidade com versões recentes e adicionado .catch() para evitar erros no log.
            player.dimension.runCommandAsync(`setblock ${pos.x} ${pos.y} ${pos.z} air destroy`).catch(() => { });
            player.dimension.runCommandAsync(`setblock ${pos.x} ${pos.y} ${pos.z} ${materialId} replace`).catch(() => { });
          } else {
            // Se for ar, podemos colocar o bloco instantaneamente via Script (mais rápido)
            block.setPermutation(BlockPermutation.resolve(materialId));
          }
          placedInTick++;
        }
      } catch (e) {
        // Ignorar erros de local não carregado
      }
    }

    if (idx >= uniquePos.length) {
      system.clearRun(task);
      player.onScreenDisplay.setActionBar("§a✔ Construído!");
    }
  }, 1);
}




// =====================
// Eventos e Interação
// =====================
world.beforeEvents.itemUseOn.subscribe((ev) => {
  const p = ev.source;
  const item = ev.itemStack;
  if (!p || !item || item.typeId === CONFIG_ITEM) return;

  // Requisito: ter o item de configuração no inventário
  if (!hasConfigItem(p)) return;

  const s = getState(p);


  // MARCAR PONTO A (SHIFT + CLIQUE)
  if (p.isSneaking) {
    s.startPos = ev.block.location;
    s.face = ev.blockFace;
    s.materialId = item.typeId;
    s.active = true;
    s.dimension = p.dimension;

    system.run(() => {
      p.onScreenDisplay.setActionBar("§a✔ Ponto A definido! §fAponte e clique (sem SHIFT) para finalizar.");
      p.playSound("random.orb", { volume: 0.5, pitch: 1.5 });
    });
    ev.cancel = true;
    return;
  }

  // CONFIRMAR PONTO B (CLIQUE NORMAL SE A TIVER MARCADO)
  if (s.active && !p.isSneaking) {
    const endPos = ev.block.location;
    let basePos = [];
    switch (s.mode) {
      case BuildMode.NORMAL: basePos = Geometry.box(s.startPos, endPos, false); break;
      case BuildMode.LINE: basePos = Geometry.line(s.startPos, endPos); break;
      case BuildMode.WALL: basePos = Geometry.wall(s.startPos, endPos, s.face); break;
      case BuildMode.FLOOR: basePos = Geometry.floor(s.startPos, endPos); break;
      case BuildMode.DIAGONAL: basePos = Geometry.line(s.startPos, endPos); break;
      case BuildMode.BOX: basePos = Geometry.box(s.startPos, endPos, s.hollow); break;
      case BuildMode.CIRCLE: basePos = Geometry.circle(s.startPos, endPos, s.hollow); break;
      case BuildMode.CYLINDER: basePos = Geometry.cylinder(s.startPos, endPos, s.hollow); break;
      case BuildMode.SPHERE: basePos = Geometry.sphere(s.startPos, endPos, s.hollow); break;
      default: basePos = Geometry.box(s.startPos, endPos, false); break;
    }

    const finalPos = applyModifiers(s, basePos);
    solveBuild(p, finalPos, s.materialId);
    s.active = false;

    ev.cancel = true;
  }

});

// Preview Loop
system.runInterval(() => {
  for (const p of world.getPlayers()) {
    if (!hasConfigItem(p)) continue;

    const s = getState(p);
    if (!s.active) continue;

    const hit = p.getBlockFromViewDirection({ maxDistance: 48 });
    if (hit) {
      const endPos = hit.block.location;
      if (!isValidPos(s.startPos) || !isValidPos(endPos)) continue;

      try {
        // Desenhar mini preview visual (partículas nos cantos)
        p.dimension.spawnParticle("minecraft:endrod", { x: s.startPos.x + 0.5, y: s.startPos.y + 1, z: s.startPos.z + 0.5 });
        p.dimension.spawnParticle("minecraft:basic_flame_particle", { x: endPos.x + 0.5, y: endPos.y + 1, z: endPos.z + 0.5 });
      } catch (e) { }

      p.onScreenDisplay.setActionBar(`§e[A] §fmarcado! §7Modo: ${s.mode.toUpperCase()}`);
    }
  }
}, 2);


// Menu
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId === CONFIG_ITEM) {
    const p = ev.source;
    const s = getState(p);
    const form = new ActionFormData()
      .title("§l§bBuilder Config")
      .button("§eModo: " + s.mode.toUpperCase())
      .button(s.onlyAir ? "§aApenas Ar: ON" : "§cApenas Ar: OFF")
      .button(s.hollow ? "§bVazio (Oco): ON" : "§7Vazio (Oco): OFF")
      .button("§4Resetar Seleção");

    system.run(async () => {
      const res = await form.show(p);
      if (res.canceled) return;
      if (res.selection === 0) {
        const modes = Object.values(BuildMode);
        let idx = modes.indexOf(s.mode);
        s.mode = modes[(idx + 1) % modes.length];
      } else if (res.selection === 1) s.onlyAir = !s.onlyAir;
      else if (res.selection === 2) s.hollow = !s.hollow;
      else if (res.selection === 3) s.active = false;
    });
  }
});
