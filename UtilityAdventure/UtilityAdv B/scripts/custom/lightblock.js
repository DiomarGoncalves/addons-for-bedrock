import { world, system, DimensionTypes, MolangVariableMap } from "@minecraft/server";

const PARTICLE_ID = "minecraft:basic_flame_particle";

class LightBlock {
    constructor(block, dimension) {
        this.block = block;
        this.dimension = dimension; 
    }

    /** Spawn flame and dust particles randomly around the light block */
    addParticles() {
        const loc = this.getRandomLoc();
      /*  const molang = new MolangVariableMap();


        molang.setColorRGB("variable.color", {
            red: Math.random(),
            green: Math.random(),
            blue: Math.random()
        });*/

        // Spawn multiple particle types
        this.dimension.spawnParticle("minecraft:dust_plume", loc);
        this.dimension.spawnParticle(PARTICLE_ID, loc);
        this.dimension.spawnParticle(PARTICLE_ID, loc);

        
        system.runTimeout(() => {
            this.dimension.spawnParticle(PARTICLE_ID, loc);
            this.dimension.spawnParticle(PARTICLE_ID, loc);
        }, 20);
    }

    /** Return a random particle position around the block */
    getRandomLoc() {
        const { x, y, z } = this.block.location; 
        const points = [
            { x: x + 0.5, y: y + 0.5, z: z + 0.5 },
            { x: x + 0.6, y: y + 0.4, z: z + 0.4 },
            { x: x + 0.4, y: y + 0.5, z: z + 0.6 },
            { x: x + 0.7, y: y + 0.3, z: z + 0.7 }
        ];

        return points[Math.floor(Math.random() * points.length)];
    }
}

/* Register custom block behavior for Light Block */

system.beforeEvents.startup.subscribe((e) => {
    e.blockComponentRegistry.registerCustomComponent("lightwand:light_block", {
        onTick(ev) {
            const lightBlock = new LightBlock(ev.block, ev.dimension);
            lightBlock.addParticles();
        }
    });
    e.blockComponentRegistry.registerCustomComponent("lightwand:light_block_throw", {
        onTick(ev) {
            ev.dimension.setBlockType(ev.block.location, "minecraft:air")
        }
    });
});

/* Particle trail for flying torch projectiles */
system.runInterval(() => {
    const dimensionTypes = DimensionTypes.getAll();

    for (const dimType of dimensionTypes) {
        const dim = world.getDimension(dimType.typeId);
        const torches = dim.getEntities({ tags: ["torch_projectile"] });

        for (const entity of torches) {
                        entity.addEffect("invisibility", 1, { showParticles: false })

            dim.spawnParticle(PARTICLE_ID, entity.location);
                            let pos = entity.location
                let loc = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z - 1) }
                if(dim.getBlock(loc).typeId !== "minecraft:air") return;

                dim.setBlockType(loc, "lightwand:light_block_throw")
            

        }
    }
}, 1);