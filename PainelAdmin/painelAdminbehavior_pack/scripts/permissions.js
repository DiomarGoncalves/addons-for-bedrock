export class PermissionManager {
    constructor() {
        this.donoTag = 'admin_dono';
        this.staffTag = 'admin_staff';
    }

    getPermissionLevel(player) {
        if (player.hasTag(this.donoTag)) {
            return 'dono';
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
        if (requiredLevel === 'dono') return level === 'dono';

        return false;
    }

    setdono(player) {
        player.addTag(this.donoTag);
        player.removeTag(this.staffTag);
        player.sendMessage('§8[admin painel] você agora é dono!');
    }

    setStaff(player) {
        player.removeTag(this.donoTag);
        player.addTag(this.staffTag);
        player.sendMessage('§8[admin painel] você agora é staff!');
    }

    removePermissions(player) {
        player.removeTag(this.donoTag);
        player.removeTag(this.staffTag);
        player.sendMessage('§8[admin painel] suas permissões foram removidas!');
    }
}
