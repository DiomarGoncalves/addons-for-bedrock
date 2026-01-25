import { system, world } from "@minecraft/server";
import { JetpackConfig } from "./jetpack.config";
import { InventoryUtils } from "../shared/inventory.utils";
import { PlayerState } from "../shared/state.store";

const TAG_FLY = "custom:JetpackMayfly";

// Loop (ticks). 5 é bem responsivo e leve.
const LOOP_EVERY_TICKS = 5;

/**
 * Controle por player:
 * - fuelCounters: acumula ticks até bater o fuelRate e consumir 1 carvão
 * - waitingFuel: marcou que parou por falta de combustível (pra auto-resume)
 * - lastEquippedId: detecta quando equipou/tirou o jetpack pra reagir na hora
 */
const fuelCounters = new Map();   // playerId -> number
const waitingFuel = new Map();    // playerId -> boolean
const lastEquippedId = new Map(); // playerId -> string (typeId do chest) ou ""/undefined

function isCreativeLike(mode) {
  return mode === "creative" || mode === "spectator";
}

function setMayfly(player, enabled) {
  try {
    player.runCommand(`ability @s mayfly ${enabled ? "true" : "false"}`);
  } catch (_) {}
}

/**
 * Checa se tem combustível (carvão) no inventário.
 * Se seu consumeFuel aceitar carvão vegetal também, habilite a linha do charcoal.
 * Se você usa outro combustível, troca o typeId aqui.
 */
function hasFuel(player) {
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return false;

  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it) continue;

    if (it.typeId === "minecraft:coal") return true;
    // if (it.typeId === "minecraft:coal" || it.typeId === "minecraft:charcoal") return true;
  }
  return false;
}

function clearPlayerRuntime(playerId) {
  fuelCounters.delete(playerId);
  waitingFuel.delete(playerId);
  lastEquippedId.delete(playerId);
}

/**
 * Desliga tudo relacionado ao jetpack (survival/adventure).
 * markWaitingFuel=true => desativou por falta de combustível e pode auto-resumir.
 */
function forceDisableJetpack(player, actionbar, markWaitingFuel = false) {
  PlayerState.setJetpackActive(player.id, false);
  waitingFuel.set(player.id, markWaitingFuel);

  // Desliga voo nativo imediatamente (não mexe se for creative/spectator)
  if (!isCreativeLike(player.getGameMode())) {
    setMayfly(player, false);
  }

  if (player.hasTag(TAG_FLY)) player.removeTag(TAG_FLY);
  fuelCounters.set(player.id, 0);

  if (actionbar) player.onScreenDisplay.setActionBar(actionbar);
}

/**
 * Liga tudo relacionado ao jetpack (survival/adventure).
 */
function forceEnableJetpack(player, actionbar) {
  PlayerState.setJetpackActive(player.id, true);
  waitingFuel.set(player.id, false);

  // Habilita voo nativo
  if (!isCreativeLike(player.getGameMode())) {
    setMayfly(player, true);
  }

  if (!player.hasTag(TAG_FLY)) player.addTag(TAG_FLY);
  fuelCounters.set(player.id, 0);

  if (actionbar) player.onScreenDisplay.setActionBar(actionbar);
}

export class JetpackSystem {
  // Não precisa mais de onUse pra ligar/desligar.
  static onUse(_event) {}
  static tick(_player) {}
}

// ==========================================
// JETPACK AUTO (EQUIPAR COMO ARMADURA)
// ==========================================
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const mode = player.getGameMode();

    // Se o player sumiu/renasceu, garante maps ok
    if (!fuelCounters.has(player.id)) fuelCounters.set(player.id, 0);
    if (!waitingFuel.has(player.id)) waitingFuel.set(player.id, false);

    // Pega o item do peito (jetpack deve ser chestplate)
    const chest = InventoryUtils.getEquippedChestplate(player);
    const chestId = chest?.typeId ?? "";

    const tier = chest ? JetpackConfig.tiers[chest.typeId] : undefined;
    const hasJetpackEquipped = !!tier;

    // Detecta troca de equipamento (equipou/tirou) pra reagir imediatamente
    const prevChestId = lastEquippedId.get(player.id) ?? "";
    const changed = prevChestId !== chestId;
    if (changed) lastEquippedId.set(player.id, chestId);

    // Creative/Spectator: não suja estado com tag e não força on/off
    if (isCreativeLike(mode)) {
      if (player.hasTag(TAG_FLY)) player.removeTag(TAG_FLY);
      // Não precisa controlar state aqui; deixa o jogador livre.
      fuelCounters.set(player.id, 0);
      waitingFuel.set(player.id, false);
      continue;
    }

    // Se NÃO está equipado: desliga imediatamente e limpa estado
    if (!hasJetpackEquipped) {
      if (player.hasTag(TAG_FLY) || PlayerState.isJetpackActive(player.id) || waitingFuel.get(player.id)) {
        forceDisableJetpack(player, "", false);
      }
      continue;
    }

    // Agora sabemos que está equipado e é survival/adventure.

    // Ao equipar (mudou chest), já tenta habilitar automaticamente:
    if (changed) {
      // Se tem combustível, habilita na hora.
      // Se não tem, marca waiting e mantém off (mas preparado pra auto-resume quando colocar carvão).
      if (hasFuel(player)) {
        forceEnableJetpack(player, "Jetpack: §aREADY");
        player.playSound("random.click");
      } else {
        forceDisableJetpack(player, "Jetpack: §cNO FUEL", true);
        // Opcional: som de alerta baixo
        // player.playSound("random.orb");
      }
    }

    // ✅ AUTO-RESUME: se estava sem combustível e agora colocou carvão, religa sozinho
    const isWaiting = waitingFuel.get(player.id) === true;
    if (isWaiting && hasFuel(player)) {
      forceEnableJetpack(player, "Jetpack: §aFUEL RESTORED");
      player.playSound("random.click");
    }

    // Determina se deve permitir voo agora:
    const active = PlayerState.isJetpackActive(player.id);
    let shouldFly = hasJetpackEquipped && active;

    // Se está ativo, consome combustível no ritmo do tier
    if (shouldFly) {
      const rate = tier.fuelRate; // ex: 40, 60, 70...

      const acc = (fuelCounters.get(player.id) ?? 0) + LOOP_EVERY_TICKS;

      if (acc >= rate) {
        const ok = InventoryUtils.consumeFuel(player);

        if (!ok) {
          // Acabou: desliga na hora e marca waitingFuel pra auto-resume
          forceDisableJetpack(player, "Jetpack: §cOFF (No Fuel!)", true);
          player.playSound("random.break");
          continue;
        }

        // consumiu 1 unidade, reseta contador
        fuelCounters.set(player.id, 0);
      } else {
        fuelCounters.set(player.id, acc);
      }
    } else {
      // Não está usando voo: zera contador
      fuelCounters.set(player.id, 0);
    }

    // Sincroniza mayfly/tag com shouldFly (voo disponível)
    const hasTag = player.hasTag(TAG_FLY);

    if (shouldFly && !hasTag) {
      setMayfly(player, true);
      player.addTag(TAG_FLY);
    }

    if (!shouldFly && hasTag) {
      setMayfly(player, false);
      player.removeTag(TAG_FLY);
    }
  }
}, LOOP_EVERY_TICKS);

// (Opcional) limpeza simples quando não achar player id mais (não é obrigatório)
// Se quiser, eu adiciono um "garbage collector" de maps.
