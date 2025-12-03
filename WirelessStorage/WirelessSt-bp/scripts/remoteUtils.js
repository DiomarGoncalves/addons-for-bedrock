// remoteUtils.js
import { REMOTE_ID, THEME, MAX_PER_REMOTE, DISPLAY_NAMES } from "./config.js";

/**
 * Versão do formato da lore. Atualize quando mudar estrutura da lore.
 * Quando a versão mudar, os remotes antigos serão resetados automaticamente.
 */
const REMOTE_LORE_VERSION = "WSv1";

/**
 * Garante que o item remoto tenha a lore base do sistema.
 * Se a lore for de versão diferente ou inválida, reseta para o formato atual.
 */
export function ensureLore(remote) {
  try {
    if (!remote) return null;
    const lore = remote.getLore() ?? [];

    // criterio simples: linha 1 contém a versão
    if (!lore[1] || !lore[1].includes(REMOTE_LORE_VERSION)) {
      const base = [
        `${THEME}Wireless Storage`,
        `${THEME}${REMOTE_LORE_VERSION}`,
        `${THEME}Nenhum container conectado.`,
        `${THEME}Agache + clique em um baú para conectar.`,
      ];
      remote.setLore(base);
    }
    return remote.getLore();
  } catch (err) {
    console.error("[Wireless Storage] ensureLore error:", err);
    return null;
  }
}

/**
 * Lê os dados de conexão a partir da lore do remote.
 * Retorna array de conexões ou [].
 */
export function parseRemoteData(remote) {
  try {
    if (!remote) return [];
    const lore = ensureLore(remote) ?? [];
    const out = [];
    for (const line of lore) {
      if (!line) continue;
      // nossas linhas de conexão começam com THEME + "• "
      const marker = `${THEME}• `;
      if (line.startsWith(marker)) {
        const raw = line.slice(marker.length);
        const parts = raw.split("|");
        if (parts.length >= 6) {
          const [name, xs, ys, zs, dim, type] = parts;
          const x = Number(xs), y = Number(ys), z = Number(zs);
          out.push({ name, x, y, z, dimension: dim, blockType: type });
        } else {
          console.warn("[Wireless Storage] parseRemoteData: linha inválida:", line);
        }
      }
    }
    return out;
  } catch (err) {
    console.error("[Wireless Storage] parseRemoteData error:", err);
    return [];
  }
}

/**
 * Escreve a lista de conexões na lore do remote.
 */
export function writeRemoteData(remote, list) {
  try {
    if (!remote) return;
    const header = [`${THEME}Wireless Storage`, `${THEME}${REMOTE_LORE_VERSION}`];
    const body =
      list.length === 0
        ? [`${THEME}Nenhum container conectado.`, `${THEME}Agache + clique em um baú para conectar.`]
        : list.map((c) => `${THEME}• ${c.name}|${c.x}|${c.y}|${c.z}|${c.dimension}|${c.blockType}`);

    const human = [];
    if (list.length > 0) {
      human.push(`${THEME}Conectados: ${list.length}/${MAX_PER_REMOTE}`);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const dn = DISPLAY_NAMES[c.blockType] ?? c.blockType.replace("minecraft:", "");
        human.push(`${THEME}${i + 1}. ${c.name} — ${dn} (${c.x}, ${c.y}, ${c.z})`);
      }
      human.push(`${THEME}Use o controle para acessar o menu.`);
    }

    remote.setLore([...header, ...body, ...(human.length ? ["", ...human] : [])]);
  } catch (err) {
    console.error("[Wireless Storage] writeRemoteData error:", err);
  }
}

/**
 * Tenta encontrar o Remote control na mão principal, mão offhand, ou em qualquer slot do inventário.
 * Retorna { container, slot, item } onde item é o ItemStack do remote (ou null se não encontrado).
 */
export function getHandRemote(player) {
  try {
    if (!player) return { container: null, slot: -1, item: null };

    const invComp = player.getComponent("minecraft:inventory");
    const inv = invComp?.container;
    if (!inv) return { container: null, slot: -1, item: null };

    // 1) mão principal (selectedSlot)
    const selected = typeof player.selectedSlot === "number" ? player.selectedSlot : 0;
    try {
      const main = inv.getItem(selected);
      if (main && main.typeId === REMOTE_ID) return { container: inv, slot: selected, item: main };
    } catch (eMain) {
      // ignore, pode acontecer em alguns ticks
    }

    // 2) procurar offhand (API Bedrock não tem getOffhand padronizado, mas alguns containers usam slot index alto)
    // Tentativa: checar slots de 36 até 44 (comum em algumas implementações), mas cuidado: se não existir, try/catch protege.
    for (let s = inv.size - 1; s >= Math.max(0, inv.size - 9); s--) {
      try {
        const it = inv.getItem(s);
        if (it && it.typeId === REMOTE_ID) return { container: inv, slot: s, item: it };
      } catch {}
    }

    // 3) fallback: varrer inventário todo procurando o primeiro remote
    for (let i = 0; i < inv.size; i++) {
      try {
        const it = inv.getItem(i);
        if (it && it.typeId === REMOTE_ID) return { container: inv, slot: i, item: it };
      } catch {}
    }

    // não encontrado
    return { container: inv, slot: selected, item: null };
  } catch (err) {
    console.error("[Wireless Storage] getHandRemote error:", err);
    return { container: null, slot: -1, item: null };
  }
}

/**
 * Atualiza o item na mão do jogador (mesmo slot que getHandRemote retornou).
 * Se slot inválido, tenta colocar no selectedSlot.
 */
export function updateHandRemote(player, item) {
  try {
    const invComp = player.getComponent("minecraft:inventory");
    const inv = invComp?.container;
    if (!inv) return false;
    const selected = typeof player.selectedSlot === "number" ? player.selectedSlot : 0;
    inv.setItem(selected, item);
    return true;
  } catch (err) {
    console.error("[Wireless Storage] updateHandRemote error:", err);
    return false;
  }
}
