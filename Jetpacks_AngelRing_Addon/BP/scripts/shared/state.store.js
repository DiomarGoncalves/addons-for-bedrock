export const PlayerState = {
    activeJetpacks: new Set(),
    activeAngelRings: new Set(),
    hoverMode: new Set(),

    isJetpackActive(playerId) {
        return this.activeJetpacks.has(playerId);
    },

    setJetpackActive(playerId, active) {
        if (active) this.activeJetpacks.add(playerId);
        else this.activeJetpacks.delete(playerId);
    },

    isAngelRingActive(playerId) {
        return this.activeAngelRings.has(playerId);
    },

    setAngelRingActive(playerId, active) {
        if (active) this.activeAngelRings.add(playerId);
        else this.activeAngelRings.delete(playerId);
    },

    isHovering(playerId) {
        return this.hoverMode.has(playerId);
    },

    setHovering(playerId, active) {
        if (active) this.hoverMode.add(playerId);
        else this.hoverMode.delete(playerId);
    }
};
