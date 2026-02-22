// ─────────────────────────────────────────────────────────────────────────────
// NotificationUI — Floating notification popups
//
// Shows floating text like "+200₽ Earned!" or "+40 XP!" that rises and fades.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'

export class NotificationUI {
    private scene: Phaser.Scene

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    /**
     * Show a floating notification that rises and fades out.
     * @param message Text to display
     * @param color Text color (hex string)
     * @param x X position (default: center)
     * @param y Y position (default: center-top area)
     */
    show(message: string, color = '#f0d860', x = 400, y = 200): void {
        const text = this.scene.add.text(x, y, message, {
            fontSize: '16px',
            color,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            backgroundColor: '#00000088',
            padding: { x: 8, y: 4 },
        }).setOrigin(0.5).setDepth(95).setScrollFactor(0)

        this.scene.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 2000,
            ease: 'Cubic.easeOut',
            onComplete: () => text.destroy(),
        })
    }

    /** Show money gained notification */
    showMoney(amount: number): void {
        this.show(`+${amount}₽ Earned!`, '#f0d860', 400, 180)
    }

    /** Show XP gained notification */
    showXP(amount: number): void {
        this.show(`+${amount} XP!`, '#40a0f0', 400, 210)
    }

    /** Show level up notification */
    showLevelUp(name: string, level: number): void {
        this.show(`${name} grew to Lv${level}!`, '#60f060', 400, 160)
    }

    /** Show checkpoint reached notification */
    showCheckpoint(name: string): void {
        this.show(`📍 Checkpoint: ${name}`, '#88ffaa', 400, 40)
    }
}
