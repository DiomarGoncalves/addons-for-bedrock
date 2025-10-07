export class PermissionManager {
    constructor() {
        this.ownerTag = 'admin_owner';
        this.staffTag = 'admin_staff';
    }

    getPermissionLevel(player) {
        if (player.hasTag(this.ownerTag)) {
            return 'owner';
        }

        if (player.hasTag(this.staffTag)) {
            return 'staff';
        }

        return 'none';
    }

    hasPermission(player, requiredLevel = 'staff') {
        const level = this.getPermissionLevel(player);

        if (level === 'none') return false;
        if (requiredLevel === 'staff') return true;
        if (requiredLevel === 'owner') return level === 'owner';

        return false;
    }

    setOwner(player) {
        player.addTag(this.ownerTag);
        player.removeTag(this.staffTag);
        player.sendMessage('§8[admin panel] você agora é dono!');
    }

    setStaff(player) {
        player.removeTag(this.ownerTag);
        player.addTag(this.staffTag);
        player.sendMessage('§8[admin panel] você agora é staff!');
    }

    removePermissions(player) {
        player.removeTag(this.ownerTag);
        player.removeTag(this.staffTag);
        player.sendMessage('§8[admin panel] suas permissões foram removidas!');
    }
}
