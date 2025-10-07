'use strict';
/**
 * @file behavior_pack/scripts/grenadeSystem.js
 * @description Código revisado e documentado do add-on. Mantidas todas as funções originais, com melhorias de legibilidade e comentários.
 * @note Compatível com Script API moderna do Bedrock (@minecraft/server).
 */

import { world, system } from '@minecraft/server';

/**
 * GrenadeSystem: sistema principal.
 * @class
 */
export class GrenadeSystem{
    /**
  * Construtor padrão.
  */
 constructor() {
        this.grenades = {
            'gun:frag_grenade': {
                name: 'Granada Fragmentação',
                damage: 20,
                radius: 6,
                fuseTime: 60
            },
            'gun:smoke_grenade': {
                name: 'Granada de Fumaça',
                damage: 0,
                radius: 8,
                fuseTime: 40,
                smokeTime: 200
            },
            'gun:flash_grenade': {
                name: 'Granada Flash',
                damage: 2,
                radius: 10,
                fuseTime: 30,
                blindTime: 60
            }
        };

        this.activeGrenades = [];
    }/**
 * isGrenade
 * @param itemId
 */
isGrenade(itemId) {
        return this.grenades.hasOwnProperty(itemId);
    }/**
 * throwGrenade
 * @param player, itemStack
 */
throwGrenade(player, itemStack) {
        const grenadeType = this.grenades[itemStack.typeId];
        if (!grenadeType) return;

        const viewDirection = player.getViewDirection();
        const throwPower = 1.5;

        const velocity = {
            x: viewDirection.x * throwPower,
            y: viewDirection.y * throwPower + 0.5,
            z: viewDirection.z * throwPower
        };

        const startLocation = {
            x: player.location.x,
            y: player.location.y + 1.5,
            z: player.location.z
        };

        this.simulateGrenadePhysics(player, startLocation, velocity, itemStack.typeId, grenadeType);

        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;
        const slot = player.selectedSlot;
        const item = container.getItem(slot);/**
 * if
 * @param item && item.amount > 1
 */
if(item && item.amount > 1) {
            item.amount--;
            container.setItem(slot, item);
        } else {
            container.setItem(slot, undefined);
        }

        player.sendMessage(`§e[Guns] ${grenadeType.name} lançada!`);
        player.playSound('random.bow');
    }/**
 * simulateGrenadePhysics
 * @param thrower, location, velocity, grenadeId, grenadeType
 */
simulateGrenadePhysics(thrower, location, velocity, grenadeId, grenadeType) {
        const grenadeData = {
            location: {location },
            velocity: {velocity },
            thrower: thrower,
            type: grenadeId,
            data: grenadeType,
            ticksAlive: 0
        };

        this.activeGrenades.push(grenadeData);

        const updateInterval = system.runInterval(() => {
            grenadeData.ticksAlive++;

            velocity.y -= 0.05;

            grenadeData.location.x += velocity.x * 0.2;
            grenadeData.location.y += velocity.y * 0.2;
            grenadeData.location.z += velocity.z * 0.2;

            thrower.dimension.spawnParticle('minecraft:basic_smoke_particle', grenadeData.location);

            const block = thrower.dimension.getBlock(grenadeData.location);
            const hitGround = block && block.isSolid;/**
 * if
 * @param grenadeData.ticksAlive >= grenadeType.fuseTime || hitGround
 */
if(grenadeData.ticksAlive >= grenadeType.fuseTime || hitGround) {
                system.clearRun(updateInterval);
                this.explodeGrenade(grenadeData);
                this.activeGrenades = this.activeGrenades.filter(g => g !== grenadeData);
            }
        }, 1);
    }/**
 * explodeGrenade
 * @param grenadeData
 */
explodeGrenade(grenadeData) {
        const { location, thrower, data, type } = grenadeData;/**
 * if
 * @param type === 'gun:frag_grenade'
 */
if(type === 'gun:frag_grenade') {
            this.fragExplosion(location, thrower, data);
        } else if (type === 'gun:smoke_grenade') {
            this.smokeEffect(location, thrower.dimension, data);
        } else if (type === 'gun:flash_grenade') {
            this.flashEffect(location, thrower, data);
        }
    }/**
 * fragExplosion
 * @param location, thrower, data
 */
fragExplosion(location, thrower, data) {
        thrower.dimension.createExplosion(location, data.radius / 3, {
            breaksBlocks: false,
            causesFire: false,
            source: thrower
        });

        const entities = thrower.dimension.getEntities({
            location: location,
            maxDistance: data.radius
        });/**
 * for
 * @param const entity of entities
 */
for(const entity of entities) {
            const distance = this.getDistance(location, entity.location);/**
 * if
 * @param distance <= data.radius
 */
if(distance <= data.radius) {
                const damageMultiplier = 1 - (distance / data.radius);
                const damage = Math.floor(data.damage * damageMultiplier);

                try {
                    entity.applyDamage(damage, {
                        cause: 'entityExplosion',
                        damagingEntity: thrower
                    });
                } catch (error) {
                    console.warn(`Erro ao aplicar dano de granada: ${error}`);
                }
            }
        }

        thrower.dimension.playSound('random.explode', location);
    }/**
 * smokeEffect
 * @param location, dimension, data
 */
smokeEffect(location, dimension, data) {
        let smokeTicks = 0;

        const smokeInterval = system.runInterval(() => {
            smokeTicks++;/**
 * for
 * @param let i = 0; i < 20; i++
 */
for(let i = 0; i < 20; i++) {
                const offsetX = (Math.random() - 0.5) * data.radius;
                const offsetY = Math.random() * 3;
                const offsetZ = (Math.random() - 0.5) * data.radius;

                const particleLocation = {
                    x: location.x + offsetX,
                    y: location.y + offsetY,
                    z: location.z + offsetZ
                };

                dimension.spawnParticle('minecraft:large_smoke_particle', particleLocation);
            }/**
 * if
 * @param smokeTicks >= data.smokeTime
 */
if(smokeTicks >= data.smokeTime) {
                system.clearRun(smokeInterval);
            }
        }, 1);
    }/**
 * flashEffect
 * @param location, thrower, data
 */
flashEffect(location, thrower, data) {/**
 * for
 * @param let i = 0; i < 50; i++
 */
for(let i = 0; i < 50; i++) {
            const offsetX = (Math.random() - 0.5) * data.radius;
            const offsetY = (Math.random() - 0.5) * data.radius;
            const offsetZ = (Math.random() - 0.5) * data.radius;

            const particleLocation = {
                x: location.x + offsetX,
                y: location.y + offsetY,
                z: location.z + offsetZ
            };

            thrower.dimension.spawnParticle('minecraft:bleach', particleLocation);
        }

        const entities = thrower.dimension.getEntities({
            location: location,
            maxDistance: data.radius,
            type: 'minecraft:player'
        });/**
 * for
 * @param const entity of entities
 */
for(const entity of entities) {
            try {
                entity.addEffect('blindness', data.blindTime, {
                    amplifier: 1,
                    showParticles: false
                });

                entity.addEffect('nausea', data.blindTime / 2, {
                    amplifier: 1,
                    showParticles: false
                });

                entity.sendMessage('§f[Guns] §7Você foi cegado por uma granada flash!');
            } catch (error) {
                console.warn(`Erro ao aplicar efeito de flash: ${error}`);
            }
        }

        thrower.dimension.playSound('random.levelup', location, { pitch: 2.0, volume: 1.0 });
    }/**
 * getDistance
 * @param pos1, pos2
 */
getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
