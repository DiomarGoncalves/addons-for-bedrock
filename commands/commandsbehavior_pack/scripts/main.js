// ==============================
// main.js (organizado)
// ==============================

import { world, system, Player } from "@minecraft/server";
import { showMainMenu } from "./ui/mainMenu.js";
import { CommandManager } from "./commandManager.js";

// ------------------------------
// Constantes
// ------------------------------
const painel_ITEM = "painel:painel_comandos";

// ------------------------------
// Utilitários: runIntervalCompat / clearIntervalCompat
// ------------------------------
function runIntervalCompat(cb, interval) {
  try {
    if (typeof system !== "undefined" && typeof system.runInterval === "function") {
      return system.runInterval(cb, Math.max(1, interval | 0));
    }
  } catch {}
  // Fallback básico via tick
  try {
    if (world && world.afterEvents && world.afterEvents.tick) {
      let elapsed = 0;
      const target = Math.max(1, interval | 0);
      const handler = world.afterEvents.tick.subscribe(() => {
        elapsed++;
        if (elapsed >= target) {
          elapsed = 0;
          try { cb(); } catch {}
        }
      });
      return { __tickHandler: handler };
    }
  } catch {}
  return undefined;
}

function clearIntervalCompat(handle) {
  try {
    if (typeof system !== "undefined" && typeof system.clearRun === "function" && typeof handle === "number") {
      system.clearRun(handle);
      return;
    }
  } catch {}
  try {
    if (handle && handle.__tickHandler && world?.afterEvents?.tick) {
      world.afterEvents.tick.unsubscribe(handle.__tickHandler);
    }
  } catch {}
}

// ------------------------------
// (Opcional/Legado) Registro de Dynamic Properties protegido
// - Mantido para compat, mas isolado e sem afetar o fluxo
// ------------------------------
function registerLegacyDynamicPropertiesGuard() {
  try {
    let DPD;
    try {
      DPD = (typeof globalThis !== "undefined" && globalThis.DynamicPropertiesDefinition)
        ? globalThis.DynamicPropertiesDefinition
        : undefined;
    } catch {}

    if (!DPD) {
      try { /* eslint-disable no-undef */ DPD = (typeof DynamicPropertiesDefinition !== "undefined") ? DynamicPropertiesDefinition : undefined; } catch {}
    }

    if (DPD && world?.afterEvents?.worldInitialize) {
      world.afterEvents.worldInitialize.subscribe((ev) => {
        try {
          const def = new DPD();
          // Mantido como no original (não quebra em APIs que não expõem isso)
          try { def.defineString && def.defineString("commands_data", 16000); } catch {}
          try { ev.propertyRegistry && ev.propertyRegistry.registerPlayerWorldDynamicProperties && ev.propertyRegistry.registerPlayerWorldDynamicProperties(def); } catch {}
        } catch {}
      });
    }
  } catch {}
}

// Chamada do guard legado (não interfere se a API não existir)
registerLegacyDynamicPropertiesGuard();

// ------------------------------
// Handlers de evento
// ------------------------------

// 1) Abrir painel ao usar o item designado
world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;
  if (!itemStack || itemStack.typeId !== painel_ITEM) return;

  if (!player.hasTag("comandos")) {
    player.sendMessage("§8 Você não tem permissão para usar este painel.");
    return;
  }

  system.run(() => {
    showMainMenu(player);
  });
});

// 2) Loop por tick para executar comandos de "primeiro tick" (executeFirstTick)
runIntervalCompat(() => {
  const players = world.getPlayers?.() ?? world.getAllPlayers?.() ?? [];
  for (const player of players) {
    if (!player.hasTag("comandos")) continue;

    const commands = CommandManager.getCommands(player);
    for (const cmd of commands) {
      if (cmd?.type === "impulse" && cmd.executeFirstTick && !cmd.executed) {
        CommandManager.executeImpulse(player, cmd.command, cmd.conditional);
        cmd.executed = true;
        CommandManager.updateCommand(player, cmd.id, cmd);
      }
    }
  }
}, 1);

// 3) Ao jogador sair, interromper execuções repetidas ativas desse jogador
world.beforeEvents.playerLeave.subscribe((event) => {
  const player = event.player;
  const commands = CommandManager.getCommands(player);
  for (const cmd of commands) {
    if (CommandManager.isRepeating(cmd.id)) {
      CommandManager.stopRepeatingCommand(cmd.id);
    }
  }
});
