import {
  system,
  CommandPermissionLevel,
  CustomCommandParamType,
  BlockPermutation
} from "@minecraft/server";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand({
    name: "dc:update_block",
    description: "Refresh all cloud_redstone:redstone_circuit blocks in a radius.",
    aliases: ["ub"],
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    parameters: [
      { name: "radius", type: CustomCommandParamType.Int, optional: true }
    ]
  }, (origin, radius = 5) => {
    const player = origin.sourceEntity;
    if (!player) return;
    const dim = player.dimension;
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    const r = Math.max(1, Math.min(64, Math.floor(radius)));
    let count = 0;
    for (let x = px - r; x <= px + r; x++) {
      for (let y = py - r; y <= py + r; y++) {
        for (let z = pz - r; z <= pz + r; z++) {
          try {
            const block = dim.getBlock({ x, y, z });
            if (!block) continue;
            if (block.typeId !== "cloud_redstone:redstone_circuit") continue;
            const unpoweredPerm = BlockPermutation.resolve("cloud_redstone:redstone_circuit", { "ubd:powered": 0 });
            block.setType("minecraft:air");
            const rebuilt = dim.getBlock({ x, y, z });
            if (!rebuilt) continue;
            try { rebuilt.setPermutation(unpoweredPerm); } catch { try { dim.setBlockType({ x, y, z }, "cloud_redstone:redstone_circuit"); } catch {} }
            count++;
          } catch {}
        }
      }
    }
    try { player.sendMessage(`Refreshed ${count} redstone circuit blocks.`); } catch {}
  });
});