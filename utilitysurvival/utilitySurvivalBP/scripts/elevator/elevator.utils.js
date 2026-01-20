export function hasSafeHeadroom(dim, x, elevatorY, z) {
  const head1 = dim.getBlock({ x, y: elevatorY + 1, z });
  const head2 = dim.getBlock({ x, y: elevatorY + 2, z });

  const isAir = (b) => !b || b.typeId === "minecraft:air";
  return isAir(head1) && isAir(head2);
}
