'use strict';
/**
 * @file behavior_pack/scripts/ammoManager.js
 * @description Código revisado e documentado do add-on. Mantidas todas as funções originais, com melhorias de legibilidade e comentários.
 * @note Compatível com Script API moderna do Bedrock (@minecraft/server).
 */

/**
 * AmmoManager: sistema principal.
 * @class
 */
export class AmmoManager{
    /**
  * Construtor padrão.
  */
 constructor() {
        this.ammoTypes = {
            'gun:ammo_762': { name: '7.62x39mm', stackSize: 64 },
            'gun:ammo_556': { name: '5.56x45mm', stackSize: 64 },
            'gun:ammo_338': { name: '.338 Lapua', stackSize: 32 },
            'gun:ammo_50ae': { name: '.50 AE', stackSize: 32 },
            'gun:ammo_9mm': { name: '9x19mm', stackSize: 64 },
            'gun:ammo_12gauge': { name: '12 Gauge', stackSize: 32 },
            'gun:ammo_57': { name: '5.7x28mm', stackSize: 64 },
            'gun:ammo_792': { name: '7.92x57mm', stackSize: 32 }
        };

        this.magazines = {
            'gun:mag_762': { name: 'Carregador 7.62mm', ammoType: 'gun:ammo_762', capacity: 30 },
            'gun:mag_556': { name: 'Carregador 5.56mm', ammoType: 'gun:ammo_556', capacity: 30 },
            'gun:mag_338': { name: 'Carregador .338', ammoType: 'gun:ammo_338', capacity: 5 },
            'gun:mag_50ae': { name: 'Carregador .50 AE', ammoType: 'gun:ammo_50ae', capacity: 7 },
            'gun:mag_9mm': { name: 'Carregador 9mm', ammoType: 'gun:ammo_9mm', capacity: 17 },
            'gun:mag_12gauge': { name: 'Carregador 12G', ammoType: 'gun:ammo_12gauge', capacity: 8 },
            'gun:mag_57': { name: 'Carregador 5.7mm', ammoType: 'gun:ammo_57', capacity: 50 },
            'gun:mag_792': { name: 'Carregador 7.92mm', ammoType: 'gun:ammo_792', capacity: 5 }
        };
    }/**
 * isAmmo
 * @param itemId
 */
isAmmo(itemId) {
        return this.ammoTypes.hasOwnProperty(itemId);
    }/**
 * isMagazine
 * @param itemId
 */
isMagazine(itemId) {
        return this.magazines.hasOwnProperty(itemId);
    }/**
 * getAmmoCount
 * @param player, ammoType
 */
getAmmoCount(player, ammoType) {
        const inventory = player.getComponent('minecraft:inventory');
        const container = inventory.container;

        let count = 0;/**
 * for
 * @param let i = 0; i < container.size; i++
 */
for(let i = 0; i < container.size; i++) {
            const item = container.getItem(i);/**
 * if
 * @param item && item.typeId === ammoType
 */
if(item && item.typeId === ammoType) {
                count += item.amount;
            }
        }

        return count;
    }
}
