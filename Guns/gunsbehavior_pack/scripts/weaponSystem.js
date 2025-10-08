'use strict';
/**
 * @file behavior_pack/scripts/weaponSystem.js
 * @description Código revisado e documentado do add-on. Mantidas todas as funções originais, com melhorias de legibilidade e comentários.
 * @note Compatível com Script API moderna do Bedrock (@minecraft/server).
 */

import { world, system } from '@minecraft/server';

/**
 * WeaponSystem: sistema principal.
 * @class
 */
export class WeaponSystem{
    /**
  * Construtor padrão.
  */
 constructor() {
        this.weapons = {
            'gun:ak47': {
                name: 'AK-47',
                damage: 8,
                range: 50,
                fireRate: 6,
                magazineSize: 30,
                reloadTime: 40,
                ammoType: 'gun:ammo_762',
                spread: 0.5,
                auto: true
            },
            'gun:m4a1': {
                name: 'M4A1',
                damage: 7,
                range: 45,
                fireRate: 8,
                magazineSize: 30,
                reloadTime: 35,
                ammoType: 'gun:ammo_556',
                spread: 0.3,
                auto: true
            },
            'gun:awp': {
                name: 'AWP',
                damage: 20,
                range: 100,
                fireRate: 1,
                magazineSize: 5,
                reloadTime: 50,
                ammoType: 'gun:ammo_338',
                spread: 0.1,
                auto: false
            },
            'gun:desert_eagle': {
                name: 'Desert Eagle',
                damage: 12,
                range: 30,
                fireRate: 3,
                magazineSize: 7,
                reloadTime: 30,
                ammoType: 'gun:ammo_50ae',
                spread: 0.4,
                auto: false
            },
            'gun:glock': {
                name: 'Glock-18',
                damage: 5,
                range: 25,
                fireRate: 10,
                magazineSize: 17,
                reloadTime: 25,
                ammoType: 'gun:ammo_9mm',
                spread: 0.5,
                auto: false
            },
            'gun:mp5': {
                name: 'MP5',
                damage: 6,
                range: 30,
                fireRate: 12,
                magazineSize: 30,
                reloadTime: 30,
                ammoType: 'gun:ammo_9mm',
                spread: 0.6,
                auto: true
            },
            'gun:shotgun': {
                name: 'Shotgun',
                damage: 15,
                range: 15,
                fireRate: 2,
                magazineSize: 8,
                reloadTime: 45,
                ammoType: 'gun:ammo_12gauge',
                spread: 2.0,
                auto: false,
                pellets: 8
            },
            'gun:scar': {
                name: 'SCAR-L',
                damage: 9,
                range: 50,
                fireRate: 7,
                magazineSize: 30,
                reloadTime: 38,
                ammoType: 'gun:ammo_556',
                spread: 0.4,
                auto: true
            },
            'gun:p90': {
                name: 'P90',
                damage: 5,
                range: 35,
                fireRate: 15,
                magazineSize: 50,
                reloadTime: 42,
                ammoType: 'gun:ammo_57',
                spread: 0.7,
                auto: true
            },
            'gun:kar98k': {
                name: 'Kar98k',
                damage: 18,
                range: 80,
                fireRate: 1,
                magazineSize: 5,
                reloadTime: 45,
                ammoType: 'gun:ammo_792',
                spread: 0.15,
                auto: false
            }
        };

        this.cooldowns = new Map();
        this.reloading = new Map();
    }/**
 * isWeapon
 * @param itemId
 */
isWeapon(itemId) {
        return this.weapons.hasOwnProperty(itemId);
    }/**
 * getWeaponData
 * @param itemId
 */
getWeaponData(itemId) {
        return this.weapons[itemId];
    }/**
 * getCurrentAmmo
 * @param player, itemStack
 */
getCurrentAmmo(player, itemStack) {
        const ammo = itemStack.getDynamicProperty('current_ammo');/**
 * if
 * @param ammo === undefined
 */
if(ammo === undefined) {
            const weapon = this.getWeaponData(itemStack.typeId);
            itemStack.setDynamicProperty('current_ammo', weapon.magazineSize);
            return weapon.magazineSize;
        }
        return ammo;
    }/**
 * setCurrentAmmo
 * @param itemStack, amount
 */
setCurrentAmmo(itemStack, amount) {
        itemStack.setDynamicProperty('current_ammo', amount);
    }/**
 * canShoot
 * @param player, weapon
 */
canShoot(player, weapon) {
        const now = Date.now();
        const lastShot = this.cooldowns.get(player.id) || 0;
        const cooldown = 1000 / weapon.fireRate;

        return now - lastShot >= cooldown;
    }/**
 * shoot
 * @param player, itemStack
 */
shoot(player, itemStack) {
        const weapon = this.getWeaponData(itemStack.typeId);
        if (!weapon) return;

        if (this.reloading.get(player.id)) {
            player.sendMessage('§c[Guns] Recarregando');
            return;
        }

        if (!this.canShoot(player, weapon)) {
            return;
        }

        const currentAmmo = this.getCurrentAmmo(player, itemStack);/**
 * if
 * @param currentAmmo <= 0
 */
if(currentAmmo <= 0) {
            player.sendMessage('§c[Guns] Sem munição! Segure para recarregar.');
            player.playSound('random.click');
            return;
        }

        this.setCurrentAmmo(itemStack, currentAmmo - 1);
        this.cooldowns.set(player.id, Date.now());

        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;
        container.setItem(player.selectedSlot, itemStack);

        this.fireProjectile(player, weapon);

        player.playSound('mob.irongolem.hit', { pitch: 1.5, volume: 0.5 });

        this.updateAmmoDisplay(player, itemStack);
    }/**
 * fireProjectile
 * @param player, weapon
 */
fireProjectile(player, weapon) {
        const viewDirection = player.getViewDirection();
        const location = player.location;
        location.y += 1.5;

        const pellets = weapon.pellets || 1;/**
 * for
 * @param let i = 0; i < pellets; i++
 */
for(let i = 0; i < pellets; i++) {
            const spread = weapon.spread * 0.1;
            const spreadX = (Math.random() - 0.5) * spread;
            const spreadY = (Math.random() - 0.5) * spread;
            const spreadZ = (Math.random() - 0.5) * spread;

            const direction = {
                x: viewDirection.x + spreadX,
                y: viewDirection.y + spreadY,
                z: viewDirection.z + spreadZ
            };

            this.rayCast(player, location, direction, weapon);
        }
    }/**
 * rayCast
 * @param shooter, start, direction, weapon
 */
rayCast(shooter, start, direction, weapon) {
        const step = 0.5;
        const maxDistance = weapon.range;
        let currentDistance = 0;

        const location = {start };/**
 * while
 * @param currentDistance < maxDistance
 */
while(currentDistance < maxDistance) {
            location.x += direction.x * step;
            location.y += direction.y * step;
            location.z += direction.z * step;
            currentDistance += step;

            const block = shooter.dimension.getBlock(location);/**
 * if
 * @param block && block.isSolid
 */
if(block && block.isSolid) {
                shooter.dimension.spawnParticle('minecraft:critical_hit_emitter', location);
                break;
            }

            const entities = shooter.dimension.getEntities({
                location: location,
                maxDistance: 2,
                excludeTypes: ['minecraft:item']
            });/**
 * for
 * @param const entity of entities
 */
for(const entity of entities) {/**
 * if
 * @param entity.id !== shooter.id && entity.typeId !== 'minecraft:armor_stand'
 */
if(entity.id !== shooter.id && entity.typeId !== 'minecraft:armor_stand') {
                    try {
                        entity.applyDamage(weapon.damage, {
                            cause: 'entityAttack',
                            damagingEntity: shooter
                        });

                        shooter.dimension.spawnParticle('minecraft:critical_hit_emitter', entity.location);

                        shooter.sendMessage(`§e[Guns] Acerto! -${weapon.damage}❤`);
                    } catch (error) {
                        console.warn(`Erro ao aplicar dano: ${error}`);
                    }
                    return;
                }
            }
        }
    }/**
 * reload
 * @param player, itemStack
 */
reload(player, itemStack) {
        const weapon = this.getWeaponData(itemStack.typeId);
        if (!weapon) return;

        if (this.reloading.get(player.id)) {
            return;
        }

        const currentAmmo = this.getCurrentAmmo(player, itemStack);/**
 * if
 * @param currentAmmo >= weapon.magazineSize
 */
if(currentAmmo >= weapon.magazineSize) {
            player.sendMessage('§e[Guns] Carregador cheio!');
            return;
        }

        const ammoNeeded = weapon.magazineSize - currentAmmo;

        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;

        let ammoCount = 0;/**
 * for
 * @param let i = 0; i < container.size; i++
 */
for(let i = 0; i < container.size; i++) {
            const item = container.getItem(i);/**
 * if
 * @param item && item.typeId === weapon.ammoType
 */
if(item && item.typeId === weapon.ammoType) {
                ammoCount += item.amount;
            }
        }/**
 * if
 * @param ammoCount <= 0
 */
if(ammoCount <= 0) {
            player.sendMessage(`§c[Guns] Sem munição de ${weapon.ammoType}!`);
            return;
        }

        this.reloading.set(player.id, true);
        player.sendMessage('§6[Guns] Recarregando');
        player.playSound('random.break');

        system.runTimeout(() => {
            const ammoToAdd = Math.min(ammoNeeded, ammoCount);
            let ammoRemaining = ammoToAdd;/**
 * for
 * @param let i = 0; i < container.size && ammoRemaining > 0; i++
 */
for(let i = 0; i < container.size && ammoRemaining > 0; i++) {
                const item = container.getItem(i);/**
 * if
 * @param item && item.typeId === weapon.ammoType
 */
if(item && item.typeId === weapon.ammoType) {
                    const removeAmount = Math.min(item.amount, ammoRemaining);
                    ammoRemaining -= removeAmount;/**
 * if
 * @param item.amount > removeAmount
 */
if(item.amount > removeAmount) {
                        item.amount -= removeAmount;
                        container.setItem(i, item);
                    } else {
                        container.setItem(i, undefined);
                    }
                }
            }

            const newAmmo = currentAmmo + ammoToAdd;
            this.setCurrentAmmo(itemStack, newAmmo);

            const currentItem = container.getItem(player.selectedSlot);/**
 * if
 * @param currentItem && currentItem.typeId === itemStack.typeId
 */
if(currentItem && currentItem.typeId === itemStack.typeId) {
                container.setItem(player.selectedSlot, itemStack);
            }

            this.reloading.delete(player.id);
            player.sendMessage('§a[Guns] Recarregado!');
            player.playSound('random.levelup', { pitch: 2.0, volume: 0.3 });

            this.updateAmmoDisplay(player, itemStack);
        }, weapon.reloadTime);
    }/**
 * updateAmmoDisplay
 * @param player, itemStack
 */
updateAmmoDisplay(player, itemStack) {
        const weapon = this.getWeaponData(itemStack.typeId);
        if (!weapon) return;

        const currentAmmo = this.getCurrentAmmo(player, itemStack);
        player.onScreenDisplay.setActionBar(`§8Munição: §f${currentAmmo}§8/§f${weapon.magazineSize}`);
    }
}
