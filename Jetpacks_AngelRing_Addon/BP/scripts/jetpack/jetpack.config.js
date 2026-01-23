export const JetpackConfig = {
  tiers: {
    "custom:jetpack_wood": {
      name: "Wood Jetpack",
      fuelRate: 40,
      // Physics
      maxSpeed: 0.40,    // Target Horizontal Speed
      accel: 0.08,       // Acceleration (Responsiveness)
      brake: 0.06,       // Braking (Inertia: Lower = More Slide)
      upForce: 0.15,     // Vertical Thrust
      downForce: -0.2    // Vertical Dive
    },
    "custom:jetpack_iron": {
      name: "Iron Jetpack",
      fuelRate: 60,
      maxSpeed: 0.45,
      accel: 0.09,
      brake: 0.07,
      upForce: 0.18,
      downForce: -0.2
    },
    "custom:jetpack_copper": {
      name: "Copper Jetpack",
      fuelRate: 70,
      maxSpeed: 0.50,
      accel: 0.10,
      brake: 0.08,
      upForce: 0.2,
      downForce: -0.2
    },
    "custom:jetpack_gold": {
      name: "Gold Jetpack",
      fuelRate: 90,
      maxSpeed: 0.55,
      accel: 0.11,
      brake: 0.09,
      upForce: 0.25,
      downForce: -0.2
    },
    "custom:jetpack_emerald": {
      name: "Emerald Jetpack",
      fuelRate: 110,
      maxSpeed: 0.60,
      accel: 0.12,
      brake: 0.10,
      upForce: 0.3,
      downForce: -0.25
    },
    "custom:jetpack_diamond": {
      name: "Diamond Jetpack",
      fuelRate: 140,
      maxSpeed: 0.70,
      accel: 0.14,
      brake: 0.12,
      upForce: 0.35,
      downForce: -0.3
    },
    "custom:jetpack_netherite": {
      name: "Netherite Jetpack",
      fuelRate: 180,
      maxSpeed: 0.80,
      accel: 0.16,
      brake: 0.14,
      upForce: 0.4,
      downForce: -0.3
    }
  },
  angelRing: {
    identifier: "custom:angel_ring",
    name: "Angel Ring",
    fuelRate: 200000,

    // Physics Configuration (Snappy, No Inertia)
    maxSpeed: 0.75,     // Fast flight
    accel: 0.15,        // Smooth start
    brake: 0.25,        // Smooth stop
    upForce: 0.25,      // Ascent speed
    downForce: -0.25,   // Descent speed
    gravityComp: 0.06,  // Gravity Counter-force (Lowered from 0.07 to fix rising)
    hoverStabilize: 0.4 // Restored to 0.4 for better locking (now that gravity is fixed)
  }
};
