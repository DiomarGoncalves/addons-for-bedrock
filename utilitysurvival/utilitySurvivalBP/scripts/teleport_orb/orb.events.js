import { world, system } from "@minecraft/server";
import { ORB_ID } from "../config/constants";
import { showMainMenu } from "./orb.ui";

world.beforeEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack.typeId !== ORB_ID) return;
  const player = ev.source;

  // Executa a UI no próximo tick para sair do contexto do beforeEvent
  system.run(() => showMainMenu(player));
});
