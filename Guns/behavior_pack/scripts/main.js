import { world, system } from '@minecraft/server';
import { WeaponSystem } from './weaponSystem.js';
import { AmmoManager } from './ammoManager.js';
import { GrenadeSystem } from './grenadeSystem.js';

const weaponSystem = new WeaponSystem();
const ammoManager = new AmmoManager();
const grenadeSystem = new GrenadeSystem();

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;

    if (weaponSystem.isWeapon(itemStack.typeId)) {
        system.run(() => {
            weaponSystem.shoot(player, itemStack);
        });
    } else if (grenadeSystem.isGrenade(itemStack.typeId)) {
        system.run(() => {
            grenadeSystem.throwGrenade(player, itemStack);
        });
    }
});

world.afterEvents.itemCompleteUse.subscribe((event) => {
    const { source: player, itemStack } = event;

    if (weaponSystem.isWeapon(itemStack.typeId)) {
        system.run(() => {
            weaponSystem.reload(player, itemStack);
        });
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const mainhand = player.getComponent('minecraft:inventory')?.container?.getItem(player.selectedSlot);
        if (mainhand && weaponSystem.isWeapon(mainhand.typeId)) {
            weaponSystem.updateAmmoDisplay(player, mainhand);
        }
    }
}, 5);

console.warn('[Guns Addon] Sistema de armas carregado!');
