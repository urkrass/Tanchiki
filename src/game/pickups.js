export const PICKUP_TYPES = new Set(["repair", "ammo", "shield"]);
export const DEFAULT_REPAIR_AMOUNT = 1;
export const DEFAULT_AMMO_AMOUNT = 3;
export const DEFAULT_SHIELD_CHARGES = 1;

export function createPickup({
  id,
  type,
  gridX,
  gridY,
  amount,
  active = true
}) {
  const pickupAmount = amount ?? defaultAmountForType(type);
  validatePickupShape({ id, type, gridX, gridY, amount: pickupAmount });

  return {
    id,
    type,
    gridX,
    gridY,
    amount: pickupAmount,
    active
  };
}

export function createPickupFromSchema(schema) {
  return createPickup(schema);
}

export function collectPickupAtCell(pickups, playerState, x, y) {
  const pickup = pickups.find((candidate) => (
    candidate.active
    && candidate.gridX === x
    && candidate.gridY === y
  ));

  if (!pickup) {
    return null;
  }

  applyPickup(pickup, playerState);
  pickup.active = false;
  return pickup;
}

export function consumeShieldCharge(playerState) {
  if ((playerState.shieldCharges ?? 0) <= 0) {
    return false;
  }

  playerState.shieldCharges -= 1;
  return true;
}

function applyPickup(pickup, playerState) {
  if (pickup.type === "repair") {
    const repairAmount = pickup.amount + (playerState.repairAmountBonus ?? 0);
    playerState.hp = Math.min(playerState.maxHp, playerState.hp + repairAmount);
    return;
  }

  if (pickup.type === "ammo") {
    playerState.ammoReserve += pickup.amount;
    return;
  }

  if (pickup.type === "shield") {
    playerState.shieldCharges += pickup.amount;
  }
}

function defaultAmountForType(type) {
  if (type === "repair") {
    return DEFAULT_REPAIR_AMOUNT;
  }
  if (type === "ammo") {
    return DEFAULT_AMMO_AMOUNT;
  }
  if (type === "shield") {
    return DEFAULT_SHIELD_CHARGES;
  }
  throw new Error(`Unknown pickup type ${type}.`);
}

function validatePickupShape({ id, type, gridX, gridY, amount }) {
  if (!id) {
    throw new Error("Pickup must include an id.");
  }
  if (!PICKUP_TYPES.has(type)) {
    throw new Error(`Pickup ${id} has unknown type ${type}.`);
  }
  if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) {
    throw new Error(`Pickup ${id} must include integer gridX and gridY.`);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Pickup ${id} must include a positive integer amount.`);
  }
}
