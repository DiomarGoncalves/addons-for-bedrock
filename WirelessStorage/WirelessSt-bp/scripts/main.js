// SimpleWirelessStorage - server.js (entrypoint)
// Requer: Minecraft Bedrock 1.21+ / Script API v1.10+
// Responsável pelos eventos principais e integração com o restante dos módulos.

import { world, system } from "@minecraft/server";
import { REMOTE_ID, VALID_CONTAINERS } from "./config.js";
import { uiConnectChest, uiOpenRemote } from "./uiFlows.js";

/**
 * Pequeno "hard-reload" run para forçar ambiente e ajudar com problemas de cache
 * (mantive isto já que ajuda em builds frequentementes recarregados durante desenvolvimento).
 */
system.runTimeout(() => {
  console.warn("[Wireless Storage] SCRIPT RECARREGADO FORÇADAMENTE");
}, 1);

/**
 * Debounce/lock por jogador para evitar abrir múltiplas UIs em sequência rápida.
 * A chave é player.id (string). O valor é timestamp (ms) do último open.
 */
const playerLock = new Map(); // playerId -> timestamp (ms)
const LOCK_MS = 700; // tempo mínimo entre aberturas (ajustável)

/* =========================
   Helpers
   ========================= */

/**
 * Retorna true se o jogador estiver "bloqueado" (UI abriu recentemente).
 */
function isLocked(player) {
  try {
    const id = player?.id;
    if (!id) return true;
    const last = playerLock.get(id) ?? 0;
    if (Date.now() - last < LOCK_MS) return true;
    playerLock.set(id, Date.now());
    // libera o lock automaticamente após LOCK_MS + uma margem
    system.runTimeout(() => {
      // somente limpa se o timestamp ainda for o mesmo (não sobrescrever)
      const cur = playerLock.get(id);
      if (cur && Date.now() - cur >= LOCK_MS) playerLock.delete(id);
    }, LOCK_MS + 50);
    return false;
  } catch {
    return true; // se algo falhar, trate como bloqueado para evitar bugs
  }
}

/* =========================
   Eventos
   ========================= */

/**
 * Sneak + clique em container com o Remote -> conectar
 * Use system.run(...) para garantir que a UI seja chamada fora do tick do evento.
 */
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  try {
    const { player, block, itemStack } = ev;
    if (!player || !block) return;

    // Somente containers válidos
    if (!VALID_CONTAINERS.includes(block.typeId)) return;

    // Somente se o player estiver segurando o Remote
    if (itemStack?.typeId !== REMOTE_ID) return;

    // apenas ao agachar (sneak) - conexão de container
    if (player.isSneaking) {
      // cancelar a interação física para evitar efeitos indesejados
      ev.cancel = true;

      // Debounce por segurança: evita múltiplas UIs ao mesmo tempo
      if (isLocked(player)) {
        // evita spam de mensagens em situações normais
        // opcional: descomente para mensagens de debug
        // player.sendMessage("Ação ignorada: aguarde um momento.");
        return;
      }

      // chamar o fluxo de UI fora do tick
      system.run(() => {
        try {
          uiConnectChest(player, block);
        } catch (err) {
          try { player.sendMessage("Erro ao conectar container (veja console)."); } catch {}
          console.error("[Wireless Storage] erro uiConnectChest:", err);
        }
      });
    }
  } catch (err) {
    // log para debug - evita falhas silenciosas
    console.error("[Wireless Storage] beforeEvents.playerInteractWithBlock error:", err);
  }
});

/**
 * Usar o remote em qualquer lugar (não sneakar) -> abrir menu
 */
world.afterEvents.itemUse.subscribe((ev) => {
  try {
    // no itemUse, a propriedade é "source" (player)
    const { source: player, itemStack } = ev;
    if (!player) return;

    // Somente se estiver segurando o Remote
    if (itemStack?.typeId !== REMOTE_ID) return;

    // se estiver agachando, ignorar: a outra ação (connect) tem prioridade
    if (player.isSneaking) return;

    // Debounce: evita abrir 2x se o jogador clicar rapidamente
    if (isLocked(player)) return;

    // execute fora do tick para evitar race condition com outros eventos
    system.run(() => {
      try {
        uiOpenRemote(player);
      } catch (err) {
        try { player.sendMessage("Erro ao abrir o menu (veja console)."); } catch {}
        console.error("[Wireless Storage] erro uiOpenRemote:", err);
      }
    });
  } catch (err) {
    console.error("[Wireless Storage] afterEvents.itemUse error:", err);
  }
});

console.warn("[Wireless Storage] server.js carregado (modularizado)");
