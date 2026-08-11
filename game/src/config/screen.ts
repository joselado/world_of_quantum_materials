// Single source of truth for the game's canvas size, imported everywhere
// else that needs it (Phaser's own GameConfig in main.ts, the overworld's
// pseudo-3D projection in art/perspective.ts, BattleScene's field layout) so
// the width/height can never drift into two different numbers across files.
// 854x480 is a 16:9 "laptop window" aspect ratio -- also the aspect ratio a
// phone held sideways renders at, so this layout carries into a future
// phone-landscape touch pass without a separate aspect ratio to maintain.
export const CANVAS_W = 854;
export const CANVAS_H = 480;
