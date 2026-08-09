import Phaser from 'phaser';

export function shade(colorInt: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colorInt);
  if (amount >= 0) c.brighten(amount);
  else c.darken(-amount);
  return c.color;
}
