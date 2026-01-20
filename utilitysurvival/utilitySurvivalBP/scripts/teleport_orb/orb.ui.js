import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getPlayerWarps, savePlayerWarps, getDimensionName } from "./orb.storage";

export function showMainMenu(player) {
  const warps = getPlayerWarps(player);
  const form = new ActionFormData()
    .title("Orbe de Teleporte")
    .body("Selecione um destino ou gerencie seus pontos de teleporte.");

  warps.forEach((warp) => {
    form.button(
      `§${getColorCode(warp.color)}${warp.name}\n§F${getDimensionName(warp.dimId)}: ${Math.floor(warp.x)}, ${Math.floor(warp.y)}, ${Math.floor(warp.z)}`,
      getIconTexture(warp.icon)
    );
  });

  form.button("§2+ Adicionar novo ponto", "textures/ui/color_plus");

  form.show(player).then((response) => {
    if (response.canceled) return;

    if (response.selection === warps.length) {
      showAddWarpMenu(player);
    } else {
      showWarpOptions(player, response.selection);
    }
  });
}

function showAddWarpMenu(player) {
  const form = new ModalFormData()
    .title("Salvar Local")
    .textField("Nome do ponto", "Ex: Base, Casa, Mina...", "Casa")
    .dropdown("Cor do nome", ["White", "Green", "Blue", "Yellow", "Purple", "Red"], 1)
    .dropdown("Ícone", ["Star", "House", "Sword", "Portal", "Chest"], 1);

  form.show(player).then((res) => {
    if (res.canceled) return;

    const [name, colorIndex, iconIndex] = res.formValues;
    const color = ["White", "Green", "Blue", "Yellow", "Purple", "Red"][colorIndex];
    const icon = ["Star", "House", "Sword", "Portal", "Chest"][iconIndex];

    const newWarp = {
      id: Date.now().toString(),
      name,
      color,
      icon,
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
      dimId: player.dimension.id,
    };

    const warps = getPlayerWarps(player);
    warps.push(newWarp);
    savePlayerWarps(player, warps);

    player.sendMessage("§aPonto de teleporte salvo com sucesso!");
  });
}

function showWarpOptions(player, warpIndex) {
  const warps = getPlayerWarps(player);
  const warp = warps[warpIndex];

  const form = new ActionFormData()
    .title(warp.name)
    .body(`Posição: ${Math.floor(warp.x)}, ${Math.floor(warp.y)}, ${Math.floor(warp.z)}`)
    .button("§l§2Teleportar", "textures/ui/portalBg")
    .button("Atualizar posição", "textures/ui/refresh")
    .button("Editar detalhes", "textures/ui/pencil_edit_icon")
    .button("§cExcluir", "textures/ui/trash");

  form.show(player).then((res) => {
    if (res.canceled) return;

    if (res.selection === 0) {
      try {
        if (warp.dimId !== player.dimension.id) {
          player.teleport({ x: warp.x, y: warp.y, z: warp.z }, { dimension: world.getDimension(warp.dimId) });
        } else {
          player.teleport({ x: warp.x, y: warp.y, z: warp.z });
        }
        player.playSound("mob.endermen.portal");
        player.runCommand("particle minecraft:ender_explosion_emitter ~ ~ ~");
      } catch {
        player.sendMessage("§cErro: não foi possível teleportar. A dimensão pode estar descarregada.");
      }
    } else if (res.selection === 1) {
      warp.x = player.location.x;
      warp.y = player.location.y;
      warp.z = player.location.z;
      warp.dimId = player.dimension.id;
      savePlayerWarps(player, warps);
      player.sendMessage("§ePosição do ponto atualizada.");
    } else if (res.selection === 2) {
      showEditWarpMenu(player, warpIndex);
    } else if (res.selection === 3) {
      warps.splice(warpIndex, 1);
      savePlayerWarps(player, warps);
      player.sendMessage("§cPonto de teleporte excluído.");
    }
  });
}

function showEditWarpMenu(player, index) {
  const warps = getPlayerWarps(player);
  const warp = warps[index];

  const colors = ["White", "Green", "Blue", "Yellow", "Purple", "Red"];
  const icons = ["Star", "House", "Sword", "Portal", "Chest"];

  const form = new ModalFormData()
    .title("Editar Ponto")
    .textField("Nome", "Nome do ponto", warp.name)
    .dropdown("Cor do nome", colors, Math.max(0, colors.indexOf(warp.color)))
    .dropdown("Ícone", icons, Math.max(0, icons.indexOf(warp.icon)));

  form.show(player).then((res) => {
    if (res.canceled) return;
    const [name, cIdx, iIdx] = res.formValues;

    warp.name = name;
    warp.color = colors[cIdx];
    warp.icon = icons[iIdx];

    savePlayerWarps(player, warps);
    player.sendMessage("§aPonto de teleporte atualizado.");
  });
}

function getColorCode(colorName) {
  const map = {
    White: "f",
    Green: "a",
    Blue: "b",
    Yellow: "e",
    Purple: "d",
    Red: "c",
  };
  return map[colorName] || "f";
}

function getIconTexture(iconName) {
  const map = {
    Star: "textures/items/nether_star",
    House: "textures/items/bed_red",
    Sword: "textures/items/diamond_sword",
    Portal: "textures/ui/portalBg",
    Chest: "textures/blocks/chest_front",
  };
  return map[iconName];
}
