import { system } from "@minecraft/server";

system.beforeEvents.startup.subscribe(ev => {
    ev.blockComponentRegistry.registerCustomComponent(
        "redstone_circuit:redstone",
        RedstoneComponent
    );
});

const RedstoneComponent = {
    onTick(event) {
        const block = event.block;
        if (!block || block.typeId === "minecraft:air") return;

        const dim = block.dimension;
        const pos = block.location;

        const directions = [
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: -1, z: 0 }
        ];

        let maxPower = 0;

        for (const dir of directions) {
            try {
                const n = dim.getBlock({
                    x: pos.x + dir.x,
                    y: pos.y + dir.y,
                    z: pos.z + dir.z
                });

                if (!n) continue;

                const p = n.getRedstonePower?.() ?? 0;

                if (p > maxPower) maxPower = p;
            } catch {}
        }

        const powered = maxPower > 0 ? 1 : 0;

        try {
            const newPerm = block.permutation.withState("ubd:powered", powered);
            block.setPermutation(newPerm);
        } catch {}
    }
};