// Nessa versao do Script API nao existe DynamicPropertiesDefinition,
// entao nao registramos dynamic properties.

import "./teleport_orb/orb.events.js";
import "./elevator/elevator.logic.js";

import "./utilities/wrench.events.js";
import "./utilities/ender_hopper.logic.js";

// Chest Network (separado)
import "./utilities/chest_net/chest_net.events.js";
import "./utilities/chest_net/chest_net.logic.js";

console.warn("Addon carregado: Orb + Elevator + Utilities (Vacuum Ender Hopper + Chest Network).");