import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { makeBossCrystal } from '../art/boss';
import { shade } from '../art/colors';
import { getBiome } from '../art/biomes';
import type { Biome } from '../art/biomes';
import { playAttackEffect } from '../art/attackEffects';
import { fontPx, fontScale } from '../ui/text';
import {
  MOVES,
  canHost,
  BASE_STAT,
  getPlayerMaterial,
  getPlayerStats,
  getBattleMoves,
  enemyStatsForWorld,
} from '../data/materials';
import { victoryLine, defeatLine } from '../data/greetings';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, Stats } from '../data/types';
import { music } from '../audio/music';

const FIELD_W = 640;
const FIELD_H = 480;
const HORIZON_Y = 262;
const LOG_Y = 440; // combat log's usual bottom-anchored resting position
const BATTLE_TOKEN_STAKE = 50; // won on a win, lost (floored at 0) on a loss
const RIVAL_TOKEN_STAKE = 100; // the gating rival fight pays out double, win or lose
const OPPONENT_POS = { x: 460, y: 150 };
// A rival/boss fight's opponent sits a bit further left and renders bigger
// (see BOSS_CRYSTAL_SIZE below) than an ordinary wild encounter's 50 --
// shifted off OPPONENT_POS's x so the wider, multi-shard boss silhouette
// (art/boss.ts's makeBossCrystal) has room before the move menu (MENU_X)
// starts, rather than overlapping it.
const BOSS_OPPONENT_POS = { x: 430, y: 155 };
const BOSS_CRYSTAL_SIZE = 64;
const PLAYER_POS = { x: 180, y: 345 };
// Gap before the next turn fires -- long enough for the fuller attack beat
// (windup + travel + impact shockwave, up to ~810ms for a ring move) in
// art/attackEffects.ts to land and read clearly before the screen moves on.
const TURN_GAP_MS = 850;
// Docked to the right of the field, clear of the opponent's crystal/HP bar
// above it and the log text below.
const MENU_X = 456;
const MENU_TOP = 178;
const MENU_WIDTH = 176;
const MENU_BOTTOM_MARGIN = 16;

interface BattleInitData {
  wild: Material;
  world?: number;
  attackMultiplier?: number;
  isRival?: boolean;
}

export class BattleScene extends Phaser.Scene {
  private wild!: Material;
  private world = 1;
  private attackMultiplier = 1;
  private isRival = false;
  private playerMaterial!: Material;
  private playerStats!: Stats;
  private enemyStats!: Stats;
  private playerHp = 0;
  private opponentHp = 0;
  private turnLock = false;
  private opponentHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private opponentCrystal!: Phaser.GameObjects.Container;
  private opponentPos: { x: number; y: number } = OPPONENT_POS;
  private playerCrystal!: Phaser.GameObjects.Container;
  private logText!: Phaser.GameObjects.Text;
  private moveMenu?: Phaser.GameObjects.Container;

  constructor() {
    super('Battle');
  }

  init(data: BattleInitData) {
    this.wild = data.wild;
    this.world = data.world ?? 1;
    this.attackMultiplier = data.attackMultiplier ?? 1;
    this.isRival = data.isRival ?? false;
  }

  create() {
    music.play('battle');
    this.drawBackground();

    this.playerMaterial = getPlayerMaterial(this.game.registry);
    this.playerStats = getPlayerStats(this.game.registry);
    this.enemyStats = enemyStatsForWorld(this.world);

    const savedHp = (this.game.registry.get('playerHp') as number) || this.playerMaterial.maxHp;
    this.playerHp = Math.min(savedHp, this.playerMaterial.maxHp);
    this.opponentHp = this.wild.maxHp;
    this.turnLock = false;

    // Opponent (top-right)
    // The bar sits a fixed gap below the *measured* name label rather than a
    // hardcoded y -- the name's font size (and so its rendered height) scales
    // with the text-size setting (data/settings.ts's FONT_SCALE_PRESETS, up
    // to 2x), and a fixed gap tuned for the 1x label overlapped the bar once
    // a taller label was in play.
    const opponentName = this.add.text(400, 48, this.wild.name, {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    const opponentBarY = opponentName.y + opponentName.height + 8;
    this.add.rectangle(400, opponentBarY, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.opponentHpBar = this.add.rectangle(400, opponentBarY, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    // A rival fight's opponent is that world's boss -- render it with the
    // same gigantic, multi-shard look it has standing at the goal tile in
    // the overworld (art/boss.ts's makeBossCrystal), not the plain shared
    // makeCrystal() every ordinary wild encounter uses.
    this.opponentPos = this.isRival ? BOSS_OPPONENT_POS : OPPONENT_POS;
    this.opponentCrystal = this.isRival
      ? makeBossCrystal(this, BOSS_CRYSTAL_SIZE, this.wild.color, this.wild.variant)
      : makeCrystal(this, 50, this.wild.color, this.wild.variant);
    this.opponentCrystal.setPosition(this.opponentPos.x, this.opponentPos.y);
    this.bobCrystal(this.opponentCrystal, this.opponentPos.y);

    // Player (bottom-left)
    this.playerCrystal = makeCrystal(this, 55, this.playerMaterial.color, this.playerMaterial.variant);
    this.playerCrystal.setPosition(PLAYER_POS.x, PLAYER_POS.y);
    this.bobCrystal(this.playerCrystal, PLAYER_POS.y);

    // Everything below the crystal (the optional boost/fail note, the name,
    // the bar) is stacked from a running y rather than fixed pixel offsets --
    // same reasoning as the opponent bar above: label height scales with the
    // text-size setting (up to 2x, data/settings.ts), and fixed offsets tuned
    // for the smallest size let a taller label collide with whatever sits
    // below it (the name used to overlap the HP bar; with the boost/fail
    // note also fixed at a nearby y, moving one without the other just
    // shifts the collision).
    let playerY = PLAYER_POS.y + 30;

    if (this.attackMultiplier !== 1) {
      const boosted = this.attackMultiplier > 1;
      if (boosted) this.addBoostHalo(this.playerCrystal);
      else this.addFailCloud(this.playerCrystal);

      const boostText = this.add.text(130, playerY, boosted ? 'Attack boosted!' : 'Attack weakened...', {
        fontSize: fontPx(this, 12),
        color: boosted ? '#88ff88' : '#ff8888',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      });
      playerY += boostText.height + 4;
    }

    const playerName = this.add.text(130, playerY, this.playerMaterial.name, {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    const playerBarY = playerName.y + playerName.height + 8;
    this.add.rectangle(130, playerBarY, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(130, playerBarY, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    const openingLine = this.isRival ? `${this.wild.name} blocks the way onward!` : `A wild ${this.wild.name} appeared!`;
    this.logText = this.add.text(20, LOG_Y, '', {
      fontSize: fontPx(this, 14),
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 600 },
    });
    this.setLogText(openingLine);

    this.drawMoveMenu(getBattleMoves(this.game.registry));

    this.updateBars();
  }

  // A dedicated docked panel on the right of the field, sized to fit
  // however many moves are currently usable (getBattleMoves -- the
  // player's learned moves intersected with what their current crystal
  // form's physics supports), instead of scattering individually
  // positioned buttons across the field.
  //
  // Move menu matchup info (DESIGN.md §4): each button also shows the
  // move's power and, against *this* opponent, whether the opponent has no
  // natural way to host it at all -- the "quasiparticle mismatch"
  // double-damage rule, the sole type-interaction term in battle, marked
  // !! 2x -- previously only visible after the hit landed in the battle
  // log, so a first-time player had no way to plan a move before swinging.
  private drawMoveMenu(moveIds: string[]) {
    const rowCount = Math.max(moveIds.length, 1);
    const scale = fontScale(this);

    const container = this.add.container(0, 0).setDepth(30);
    this.moveMenu = container;

    // Title/legend built top-down first (running `y`, each line's own
    // wordWrap-driven height advancing it) so a long opponent name doesn't
    // wrap the legend into more lines than the old fixed legendH assumed
    // and run into row 1. The panel background is sized/inserted behind
    // everything once the real content height is known.
    let y = MENU_TOP + 8;
    const title = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, 'MOVES', {
        fontSize: fontPx(this, 12),
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);
    y += title.height + 4;

    const legend = this.add
      .text(MENU_X + MENU_WIDTH / 2, y, `vs ${this.wild.name}: !! no natural defense (2x)`, {
        fontSize: fontPx(this, 10),
        color: '#8fa0c9',
        align: 'center',
        wordWrap: { width: MENU_WIDTH - 12 },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0);
    container.add(legend);
    y += legend.height + 8;

    const rowsTop = y;

    if (moveIds.length === 0) {
      const empty = this.add
        .text(MENU_X + MENU_WIDTH / 2, rowsTop, 'No usable moves', {
          fontSize: fontPx(this, 11),
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: MENU_WIDTH - 16 },
        })
        .setOrigin(0.5, 0);
      container.add(empty);
      const bg = this.add
        .rectangle(MENU_X, MENU_TOP, MENU_WIDTH, rowsTop + empty.height + 12 - MENU_TOP, 0x10101c, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffe066);
      container.addAt(bg, 0);
      return;
    }

    // Row height is a hard geometric budget -- whatever vertical space is
    // left in the field below the title/legend, divided across however
    // many moves are usable -- not something the text-size setting can
    // just grow past. An 'adaptive'-type crystal (world 10's boss and its
    // wild echoes, MOVE_COMPATIBILITY's broadest entry) can host all 7
    // MOVES at once, and 7 two-line buttons at the setting's largest
    // preset would never fit no matter the row height. So each button's
    // font size is derived from its own row's actual height (fitPx) and
    // clamped against the setting-scaled desired size (desiredPx) --
    // growing with the setting wherever the box has slack (few moves), but
    // never past what the box can physically hold.
    const avail = FIELD_H - rowsTop - MENU_BOTTOM_MARGIN;
    const naturalRowH = Math.floor(avail / rowCount);
    const maxRowH = Math.round(46 * Math.min(scale, 1.35));
    const rowH = Phaser.Math.Clamp(naturalRowH, 30, Math.max(maxRowH, 30));
    const compact = rowH < 40;
    const height = rowsTop - MENU_TOP + rowCount * rowH + 8;

    const bg = this.add
      .rectangle(MENU_X, MENU_TOP, MENU_WIDTH, height, 0x10101c, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffe066);
    container.addAt(bg, 0);

    const padY = compact ? 3 : 5;
    const fitPx = Math.max(9, Math.floor((rowH - padY * 2) / 2.4));
    const desiredPx = Math.round((compact ? 10 : 12) * scale);
    const btnPx = Math.min(desiredPx, fitPx);

    moveIds.forEach((moveId, i) => {
      const move = MOVES[moveId];
      const mismatch = !canHost(this.wild.type, move.class);
      let tag = '';
      let color = '#ffff88';
      if (mismatch) {
        tag = ' !!2x';
        color = '#ffaa44';
      }
      const btn = this.add
        .text(MENU_X + MENU_WIDTH / 2, rowsTop + i * rowH, `${move.name}\nPwr ${move.power}${tag}`, {
          fontSize: `${btnPx}px`,
          color,
          backgroundColor: '#222244',
          padding: { x: 8, y: padY },
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.playerAttack(moveId));
      container.add(btn);
    });
  }

  // Colored from that world's own biome (art/biomes.ts, the same table
  // OverworldScene's corridor uses) instead of a fixed pastoral meadow --
  // every world's battles used to render the same green-hills-and-blue-sky
  // arena regardless of whether the fight was in a frozen cavern or a
  // cracked, glitching world.
  private drawBackground() {
    const biome = getBiome(this.world);
    const g = this.add.graphics();

    // Sky, brightest near the horizon where it meets the ridgeline.
    g.fillGradientStyle(biome.skyTop, biome.skyTop, biome.skyBottom, biome.skyBottom, 1);
    g.fillRect(0, 0, FIELD_W, HORIZON_Y);

    if (biome.clouds) {
      this.drawSun(560, 55);
      this.drawCloud(90, 40);
      this.drawCloud(230, 70);
      this.drawCloud(540, 40);
    }

    // Layered ridgelines behind the field, hazier and bluer the further
    // back they sit, giving the field actual depth instead of a flat
    // two-tone sky/ground split -- shaded off the biome's own hill/ground
    // colors so the layering effect survives across every palette.
    this.drawRidge(g, HORIZON_Y - 20, shade(biome.hillColor, 25), biome.hillAlpha * 0.85, [40, 150, 40, 170, 30, 140, 20, 160, 40]);
    this.drawRidge(g, HORIZON_Y - 4, biome.hillColor, biome.hillAlpha, [10, 70, 25, 95, 15, 60, 30, 80, 10]);
    this.drawRidge(g, HORIZON_Y + 6, shade(biome.ground, 22), 1, [5, 30, 10, 40, 6, 28, 12, 34, 5]);

    // Ground.
    g.fillGradientStyle(
      shade(biome.ground, 25),
      shade(biome.ground, 25),
      shade(biome.ground, -15),
      shade(biome.ground, -15),
      1
    );
    g.fillRect(0, HORIZON_Y, FIELD_W, FIELD_H - HORIZON_Y);

    this.drawBackgroundCrystals(biome);
    this.drawGroundDetail(biome);

    const shadowColor = shade(biome.ground, -40);
    this.add.ellipse(460, 195, 120, 28, shadowColor, 0.35);
    this.add.ellipse(180, 392, 130, 30, shadowColor, 0.35);
  }

  // A jagged ridge silhouette spanning the field width, from a flat
  // baseline up through a zig-zag of peaks -- used for both the hazy
  // far mountains and the closer, darker foothills.
  private drawRidge(
    g: Phaser.GameObjects.Graphics,
    baseY: number,
    color: number,
    alpha: number,
    peaks: number[]
  ) {
    const stepX = FIELD_W / (peaks.length - 1);
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(0, baseY);
    peaks.forEach((h, i) => g.lineTo(i * stepX, baseY - h));
    g.lineTo(FIELD_W, baseY);
    g.closePath();
    g.fillPath();
  }

  private drawSun(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0xfff6c9, 0.35);
    g.fillCircle(x, y, 34);
    g.fillStyle(0xfff9e0, 0.9);
    g.fillCircle(x, y, 18);
  }

  private drawCloud(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(x, y, 46, 20);
    g.fillEllipse(x - 18, y + 4, 30, 16);
    g.fillEllipse(x + 18, y + 4, 30, 16);
  }

  // A couple of small crystal outcrops jutting from the field itself --
  // purely decorative (no gameplay meaning), giving the arena a "quantum
  // materials" identity instead of a generic pastoral RPG field. Tinted off
  // the biome's own path color so they still read as an accent rather than
  // clashing with a world whose palette isn't blue/green.
  private drawBackgroundCrystals(biome: Biome) {
    const outcrop = makeCrystal(this, 16, shade(biome.path, 10), 'prism');
    outcrop.setPosition(70, 250);
    outcrop.setAlpha(0.8);

    const outcrop2 = makeCrystal(this, 11, shade(biome.path, -10), 'shard');
    outcrop2.setPosition(95, 258);
    outcrop2.setAlpha(0.75);

    const outcrop3 = makeCrystal(this, 13, shade(biome.hillColor, 25), 'shard');
    outcrop3.setPosition(600, 252);
    outcrop3.setAlpha(0.8);
  }

  // Scattered pebbles and ground tufts across the field so the ground
  // reads as textured, not a flat gradient fill -- tufts tint off the
  // biome's path color (grass green in the meadow, icy blue in the frozen
  // caverns, ...) rather than a hardcoded grass green everywhere.
  private drawGroundDetail(biome: Biome) {
    const g = this.add.graphics();
    const spots: [number, number][] = [
      [40, 300], [590, 290], [520, 340], [110, 380], [30, 420],
      [610, 400], [340, 300], [260, 440], [430, 420], [500, 460],
      [150, 300], [560, 220],
    ];
    spots.forEach(([x, y], i) => {
      const tuftColor = shade(biome.path, -10 - (y - HORIZON_Y) * 0.15);
      if (i % 3 === 0) {
        g.fillStyle(shade(biome.ground, -30), 0.55);
        g.fillEllipse(x, y, 10, 4);
        g.fillEllipse(x + 5, y + 2, 6, 3);
      } else {
        g.fillStyle(tuftColor, 0.6);
        [0, 1, 2].forEach((j) => {
          const ang = -Math.PI / 2 + (j - 1) * 0.5;
          g.fillTriangle(x, y, x + Math.cos(ang) * 3, y + Math.sin(ang) * 9, x + 3, y);
        });
      }
    });
  }

  // Correct-answer bonus: a "super saiyan" golden aura -- concentric glow
  // rings, a rotating ring of radiant spikes (additive-blended so they
  // actually glow instead of just being solid gold shapes), and rising
  // embers -- all added behind the crystal's own shapes (index 0) so the
  // crystal itself stays on top and readable.
  private addBoostHalo(container: Phaser.GameObjects.Container) {
    const glow = this.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xffe066, 0.18);
    glow.fillCircle(0, 0, 58);
    glow.lineStyle(3, 0xffe066, 0.9);
    glow.strokeCircle(0, 0, 44);
    glow.lineStyle(6, 0xffcc33, 0.4);
    glow.strokeCircle(0, 0, 52);
    container.addAt(glow, 0);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.6, to: 1 },
      scaleX: { from: 0.9, to: 1.18 },
      scaleY: { from: 0.9, to: 1.18 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const spikes = this.add.graphics();
    spikes.setBlendMode(Phaser.BlendModes.ADD);
    const spikeCount = 10;
    for (let i = 0; i < spikeCount; i++) {
      const ang = (i / spikeCount) * Math.PI * 2;
      spikes.lineStyle(2, 0xfff2b0, 0.85);
      spikes.lineBetween(Math.cos(ang) * 34, Math.sin(ang) * 34, Math.cos(ang) * 72, Math.sin(ang) * 72);
    }
    container.addAt(spikes, 0);
    this.tweens.add({ targets: spikes, angle: 360, duration: 2200, repeat: -1, ease: 'Linear' });

    for (let i = 0; i < 6; i++) {
      const ember = this.add.circle(Phaser.Math.Between(-22, 22), 34, Phaser.Math.Between(2, 3), 0xffe066, 0.9);
      container.add(ember);
      this.tweens.add({
        targets: ember,
        y: -70,
        alpha: 0,
        duration: 1000 + Math.random() * 500,
        delay: i * 180,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    }
  }

  // Wrong-answer penalty: a small grey raincloud drooping above the
  // player's crystal.
  private addFailCloud(container: Phaser.GameObjects.Container) {
    const cloud = this.add.graphics();
    cloud.fillStyle(0x777788, 0.9);
    cloud.fillEllipse(0, -58, 36, 16);
    cloud.fillEllipse(-15, -53, 22, 13);
    cloud.fillEllipse(15, -53, 22, 13);
    cloud.fillStyle(0x9999aa, 0.7);
    cloud.fillEllipse(0, -63, 26, 10);
    container.add(cloud);

    this.tweens.add({
      targets: cloud,
      y: '+=5',
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private bobCrystal(container: Phaser.GameObjects.Container, baseY: number) {
    this.tweens.add({
      targets: container,
      y: baseY - 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateBars() {
    this.opponentHpBar.width = Math.max(0, (this.opponentHp / this.wild.maxHp) * 100);
    this.playerHpBar.width = Math.max(0, (this.playerHp / this.playerMaterial.maxHp) * 100);
  }

  // Velocity decides who swings first each round (DESIGN.md §3); ties keep
  // the original player-first behavior.
  private playerAttack(moveId: string) {
    if (this.turnLock) return;
    this.turnLock = true;

    const playerFirst = this.playerStats.velocity >= this.enemyStats.velocity;
    const opponentMoveId = () => Phaser.Utils.Array.GetRandom(this.wild.moves);

    const releaseLock = () => {
      this.turnLock = false;
    };

    if (playerFirst) {
      this.resolveHit(true, moveId, () => {
        if (this.opponentHp <= 0 || this.playerHp <= 0) return;
        this.time.delayedCall(TURN_GAP_MS, () => this.resolveHit(false, opponentMoveId(), releaseLock));
      });
    } else {
      this.resolveHit(false, opponentMoveId(), () => {
        if (this.opponentHp <= 0 || this.playerHp <= 0) return;
        this.time.delayedCall(TURN_GAP_MS, () => this.resolveHit(true, moveId, releaseLock));
      });
    }
  }

  // Sets the combat-log text and repositions it upward just enough to keep
  // it on screen. Most per-turn messages are one line and rest at the usual
  // bottom-anchored LOG_Y, but a message that wraps to two lines (e.g. a
  // quasiparticle-mismatch hit's "No natural defense against this!" suffix)
  // would otherwise run its second line off the bottom of the canvas at a
  // fixed y -- `restY` lets endBattle's much longer summary reuse the same
  // clamp with a higher ceiling instead of duplicating it.
  private setLogText(text: string, restY = LOG_Y) {
    this.logText.setText(text);
    const y = Math.max(8, Math.min(restY, FIELD_H - this.logText.height - 16));
    this.logText.setPosition(20, y);
  }

  // Shared by both the player's and the opponent's swings -- the only
  // difference is which side is attacking, so the damage/crit/log/effect
  // logic lives here once instead of duplicated per side.
  private resolveHit(isPlayer: boolean, moveId: string, onDone: () => void) {
    const move = MOVES[moveId];
    const attackerStats = isPlayer ? this.playerStats : this.enemyStats;
    const defenderStats = isPlayer ? this.enemyStats : this.playerStats;
    const defenderType = isPlayer ? this.wild.type : this.playerMaterial.type;
    // A defender whose own physics can't host this quasiparticle at all (no
    // magnetic order to carry a magnon pulse, no gauge structure for an
    // anyon braid, ...) has no natural way to dampen it -- it lands at
    // double force. This is the only type-interaction term battle damage
    // has (DESIGN.md §4) -- there is no separate strong/weak type chart on
    // top of it.
    const mismatch = !canHost(defenderType, move.class);

    const critChance = Phaser.Math.Clamp((attackerStats.quantumness - BASE_STAT) * 0.02, 0, 0.5);
    const crit = Math.random() < critChance;
    const attackMult = isPlayer ? this.attackMultiplier : 1;
    const defenseFactor = BASE_STAT / defenderStats.correlation;
    const dmg = Math.round(
      move.power *
        (mismatch ? 2 : 1) *
        attackMult *
        defenseFactor *
        (crit ? 1.5 : 1) *
        Phaser.Math.FloatBetween(0.85, 1.15)
    );

    const from = isPlayer ? PLAYER_POS : this.opponentPos;
    const to = isPlayer ? this.opponentPos : PLAYER_POS;
    const targetCrystal = isPlayer ? this.opponentCrystal : this.playerCrystal;
    playAttackEffect(this, move.class, from, to, () => this.impactPunch(targetCrystal), mismatch ? 2 : 1);

    if (isPlayer) {
      this.opponentHp = Math.max(0, this.opponentHp - dmg);
    } else {
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this.game.registry.set('playerHp', this.playerHp);
      persistFromRegistry(this.game.registry);
    }
    this.updateBars();

    const mismatchText = mismatch ? ' No natural defense against this!' : '';
    const critText = crit ? ' A coherent critical hit!' : '';
    const who = isPlayer ? 'You' : `Wild ${this.wild.name}`;
    this.setLogText(`${who} used ${move.name}! (${dmg} dmg)${mismatchText}${critText}`);

    if (this.opponentHp <= 0) {
      this.endBattle(true);
      return;
    }
    if (this.playerHp <= 0) {
      this.endBattle(false);
      return;
    }
    onDone();
  }

  // Quick punchy scale-squash on the target crystal when a projectile
  // effect lands, so hits register even before the HP bar visibly moves.
  private flashHit(container: Phaser.GameObjects.Container) {
    this.tweens.add({ targets: container, scaleX: 1.18, scaleY: 0.82, duration: 90, yoyo: true });
  }

  // The full "hit landed" beat on top of art/attackEffects.ts's own impact
  // shockwave: the crystal squash, a small camera shake (kept subtle --
  // main.ts's canvas background is solid black, so anything punchier reveals
  // it at the field's fixed-coordinate edges), and a brief white flash.
  private impactPunch(container: Phaser.GameObjects.Container) {
    this.flashHit(container);
    this.cameras.main.shake(140, 0.006);
    this.cameras.main.flash(90, 255, 255, 255, false);
  }

  private endBattle(won: boolean) {
    this.moveMenu?.destroy(true);

    const stake = this.isRival ? RIVAL_TOKEN_STAKE : BATTLE_TOKEN_STAKE;
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;
    const newTokens = won ? tokens + stake : Math.max(0, tokens - stake);
    this.game.registry.set('qumatokens', newTokens);

    // Win or lose, the player crystal is fully healed afterward -- only the
    // qumatoken stake is on the line, not attrition into the next fight.
    this.game.registry.set('playerHp', this.playerMaterial.maxHp);

    // Beating the world's gating rival crystal is what actually unlocks
    // the mentor's shop/panel and the way to the next world -- see
    // OverworldScene.showRivalEncounter/maybeAutoOpenGoalDialogue.
    if (won && this.isRival) {
      const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
      this.game.registry.set('rivalDefeated', { ...rivalDefeated, [this.world]: true });
    }

    // Rivals aren't real compounds (same rule as OverworldScene's
    // discoveredMaterials), so only an ordinary wild win is ever offered to
    // Bohr's transmutation panel.
    if (won && !this.isRival) {
      const defeated = (this.game.registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [];
      if (!defeated.some((m) => m.name === this.wild.name)) {
        this.game.registry.set('defeatedMaterials', [...defeated, { name: this.wild.name, type: this.wild.type }]);
      }
    }
    persistFromRegistry(this.game.registry);

    const tokenText = won ? `+${stake} qumatokens!` : `-${tokens - newTokens} qumatokens...`;
    const flavor = won ? victoryLine(this.wild) : defeatLine(this.wild);
    const blurb = materialBlurb(this.wild);
    // The end-of-battle summary runs several lines longer than an in-combat
    // log line (flavor + token delta + the physics blurb), so it needs a
    // much higher clamp ceiling than setLogText's default LOG_Y -- a big
    // text size or a long blurb still can't push the bottom off-canvas.
    this.setLogText(`${flavor}\n${tokenText}\n\n${blurb}\n\nPress SPACE to return.`, 210);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Overworld', { world: this.world }));
  }
}
