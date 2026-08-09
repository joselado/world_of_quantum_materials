import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { shade } from '../art/colors';
import { playAttackEffect } from '../art/attackEffects';
import { MOVES, effectiveness, PLAYER_MATERIAL } from '../data/materials';
import { victoryLine, defeatLine } from '../data/greetings';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { Material } from '../data/types';
import { music } from '../audio/music';

const FIELD_W = 640;
const HORIZON_Y = 262;
const BATTLE_TOKEN_STAKE = 50; // won on a win, lost (floored at 0) on a loss
const RIVAL_TOKEN_STAKE = 100; // the gating rival fight pays out double, win or lose
const OPPONENT_POS = { x: 460, y: 150 };
const PLAYER_POS = { x: 180, y: 345 };
// Gap before the next turn fires -- long enough for the fuller attack beat
// (windup + travel + impact shockwave, up to ~810ms for a ring move) in
// art/attackEffects.ts to land and read clearly before the screen moves on.
const TURN_GAP_MS = 850;

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
  private playerHp = 0;
  private opponentHp = 0;
  private turnLock = false;
  private opponentHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private opponentCrystal!: Phaser.GameObjects.Container;
  private playerCrystal!: Phaser.GameObjects.Container;
  private logText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

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

    this.playerHp = (this.game.registry.get('playerHp') as number) || PLAYER_MATERIAL.maxHp;
    this.opponentHp = this.wild.maxHp;
    this.turnLock = false;

    // Opponent (top-right)
    this.add.text(400, 48, this.wild.name, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    this.add.rectangle(400, 70, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.opponentHpBar = this.add.rectangle(400, 70, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    this.opponentCrystal = makeCrystal(this, 50, this.wild.color, this.wild.variant);
    this.opponentCrystal.setPosition(OPPONENT_POS.x, OPPONENT_POS.y);
    this.bobCrystal(this.opponentCrystal, OPPONENT_POS.y);

    // Player (bottom-left)
    this.playerCrystal = makeCrystal(this, 55, PLAYER_MATERIAL.color, PLAYER_MATERIAL.variant);
    this.playerCrystal.setPosition(PLAYER_POS.x, PLAYER_POS.y);
    this.bobCrystal(this.playerCrystal, PLAYER_POS.y);

    this.add.text(130, 403, PLAYER_MATERIAL.name, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)',
      padding: { x: 4, y: 2 },
    });
    this.add.rectangle(130, 425, 104, 12, 0x222222, 0.55).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(130, 425, 100, 8, 0x33cc33).setOrigin(0, 0.5);

    if (this.attackMultiplier !== 1) {
      const boosted = this.attackMultiplier > 1;
      if (boosted) this.addBoostHalo(this.playerCrystal);
      else this.addFailCloud(this.playerCrystal);

      this.add.text(130, 385, boosted ? 'Attack boosted!' : 'Attack weakened...', {
        fontSize: '12px',
        color: boosted ? '#88ff88' : '#ff8888',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      });
    }

    const openingLine = this.isRival ? `${this.wild.name} blocks the way onward!` : `A wild ${this.wild.name} appeared!`;
    this.logText = this.add.text(20, 440, openingLine, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 6 },
      wordWrap: { width: 600 },
    });

    this.buttons = [];
    const unlockedMoves = (this.game.registry.get('unlockedMoves') as string[]) ?? PLAYER_MATERIAL.moves;
    unlockedMoves.forEach((moveId, i) => {
      const move = MOVES[moveId];
      const btn = this.add
        .text(10 + i * 150, 210, `[ ${move.name} ]`, {
          fontSize: '12px',
          color: '#ffff88',
          backgroundColor: '#222244',
          padding: { x: 6, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.playerAttack(moveId));
      this.buttons.push(btn);
    });

    this.updateBars();
  }

  private drawBackground() {
    const g = this.add.graphics();

    // Sky, brightest near the horizon where it meets the mountains.
    g.fillGradientStyle(0x8fc7ea, 0x8fc7ea, 0xdff3ff, 0xdff3ff, 1);
    g.fillRect(0, 0, FIELD_W, HORIZON_Y);
    this.drawSun(560, 55);

    this.drawCloud(90, 40);
    this.drawCloud(230, 70);
    this.drawCloud(540, 40);

    // Layered ridgelines behind the field, hazier and bluer the further
    // back they sit, giving the field actual depth instead of a flat
    // two-tone sky/ground split.
    this.drawRidge(g, HORIZON_Y - 20, 0xa9c2dc, 0.85, [40, 150, 40, 170, 30, 140, 20, 160, 40]);
    this.drawRidge(g, HORIZON_Y - 4, 0x7fa88f, 0.9, [10, 70, 25, 95, 15, 60, 30, 80, 10]);
    this.drawRidge(g, HORIZON_Y + 6, 0x5c9c6a, 1, [5, 30, 10, 40, 6, 28, 12, 34, 5]);

    // Ground.
    g.fillGradientStyle(0x9fd88a, 0x9fd88a, 0x5c9040, 0x5c9040, 1);
    g.fillRect(0, HORIZON_Y, FIELD_W, 480 - HORIZON_Y);

    this.drawBackgroundCrystals();
    this.drawGroundDetail();

    this.add.ellipse(460, 195, 120, 28, 0x2f5a26, 0.35);
    this.add.ellipse(180, 392, 130, 30, 0x2f5a26, 0.35);
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
  // materials" identity instead of a generic pastoral RPG field.
  private drawBackgroundCrystals() {
    const outcrop = makeCrystal(this, 16, 0x8fb0c9, 'prism');
    outcrop.setPosition(70, 250);
    outcrop.setAlpha(0.8);

    const outcrop2 = makeCrystal(this, 11, 0x8fb0c9, 'shard');
    outcrop2.setPosition(95, 258);
    outcrop2.setAlpha(0.75);

    const outcrop3 = makeCrystal(this, 13, 0x9ac9b0, 'shard');
    outcrop3.setPosition(600, 252);
    outcrop3.setAlpha(0.8);
  }

  // Scattered pebbles and grass tufts across the field so the ground
  // reads as textured turf rather than a flat gradient fill.
  private drawGroundDetail() {
    const g = this.add.graphics();
    const spots: [number, number][] = [
      [40, 300], [590, 290], [520, 340], [110, 380], [30, 420],
      [610, 400], [340, 300], [260, 440], [430, 420], [500, 460],
      [150, 300], [560, 220],
    ];
    spots.forEach(([x, y], i) => {
      const groundColor = shade(0x7cbf6a, -10 - (y - HORIZON_Y) * 0.15);
      if (i % 3 === 0) {
        g.fillStyle(0x6b5a45, 0.55);
        g.fillEllipse(x, y, 10, 4);
        g.fillEllipse(x + 5, y + 2, 6, 3);
      } else {
        g.fillStyle(groundColor, 0.6);
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
    this.playerHpBar.width = Math.max(0, (this.playerHp / PLAYER_MATERIAL.maxHp) * 100);
  }

  private playerAttack(moveId: string) {
    if (this.turnLock) return;
    this.turnLock = true;

    const move = MOVES[moveId];
    const mult = effectiveness(move.class, this.wild.type);
    const dmg = Math.round(move.power * mult * this.attackMultiplier * Phaser.Math.FloatBetween(0.85, 1.15));

    playAttackEffect(this, move.class, PLAYER_POS, OPPONENT_POS, () => this.impactPunch(this.opponentCrystal), mult);

    this.opponentHp = Math.max(0, this.opponentHp - dmg);
    this.updateBars();

    const effText = mult > 1 ? ' It was super effective!' : mult < 1 ? ' It was not very effective...' : '';
    this.logText.setText(`You used ${move.name}! (${dmg} dmg)${effText}`);

    if (this.opponentHp <= 0) {
      this.endBattle(true);
      return;
    }

    this.time.delayedCall(TURN_GAP_MS, () => this.opponentAttack());
  }

  private opponentAttack() {
    const moveId = Phaser.Utils.Array.GetRandom(this.wild.moves);
    const move = MOVES[moveId];
    const mult = effectiveness(move.class, PLAYER_MATERIAL.type);
    const dmg = Math.round(move.power * mult * Phaser.Math.FloatBetween(0.85, 1.15));

    playAttackEffect(this, move.class, OPPONENT_POS, PLAYER_POS, () => this.impactPunch(this.playerCrystal), mult);

    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.updateBars();

    this.logText.setText(`Wild ${this.wild.name} used ${move.name}! (${dmg} dmg)`);
    this.game.registry.set('playerHp', this.playerHp);
    persistFromRegistry(this.game.registry);

    if (this.playerHp <= 0) {
      this.endBattle(false);
      return;
    }

    this.turnLock = false;
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
    this.buttons.forEach((b) => b.destroy());

    const stake = this.isRival ? RIVAL_TOKEN_STAKE : BATTLE_TOKEN_STAKE;
    const tokens = (this.game.registry.get('qumatokens') as number) || 0;
    const newTokens = won ? tokens + stake : Math.max(0, tokens - stake);
    this.game.registry.set('qumatokens', newTokens);

    // Win or lose, the player crystal is fully healed afterward -- only the
    // qumatoken stake is on the line, not attrition into the next fight.
    this.game.registry.set('playerHp', PLAYER_MATERIAL.maxHp);

    // Beating the world's gating rival crystal is what actually unlocks
    // Noether's shop and the way to the next world -- see
    // OverworldScene.showRivalEncounter/maybeAutoOpenGoalDialogue.
    if (won && this.isRival) {
      const rivalDefeated = (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
      this.game.registry.set('rivalDefeated', { ...rivalDefeated, [this.world]: true });
    }
    persistFromRegistry(this.game.registry);

    const tokenText = won ? `+${stake} qumatokens!` : `-${tokens - newTokens} qumatokens...`;
    const flavor = won ? victoryLine(this.wild) : defeatLine(this.wild);
    const blurb = materialBlurb(this.wild);
    // The end-of-battle summary runs several lines longer than an
    // in-combat log line (flavor + token delta + the physics blurb) --
    // moved up from the combat log's usual bottom-anchored position so the
    // extra lines don't run off the bottom of the canvas.
    this.logText.setPosition(20, 210);
    this.logText.setText(`${flavor}\n${tokenText}\n\n${blurb}\n\nPress SPACE to return.`);

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Overworld', { world: this.world }));
  }
}
