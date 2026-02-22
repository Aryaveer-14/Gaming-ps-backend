// ─────────────────────────────────────────────────────────────────────────────
// LeaderboardUI — Top-left vertical leaderboard panel
//
// Shows ★ LEADERBOARD header with ranked player entries.
// Each entry: rank number, username, level badge (color-coded).
// Refreshes every 30 seconds.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import playerState from './PlayerState'

const LB_X = 8
const LB_Y = 8
const ROW_H = 18
const MAX_ENTRIES = 4

// Level badge color based on level
function lvlColor(lv: number): number {
    if (lv >= 30) return 0x40c040   // green (high)
    if (lv >= 10) return 0x40a0f0   // blue (mid)
    if (lv >= 1) return 0xf8d030    // yellow (low)
    return 0x888888                 // grey (0)
}

export class LeaderboardUI {
    private scene: Phaser.Scene
    private container?: Phaser.GameObjects.Container
    private refreshTimer?: Phaser.Time.TimerEvent

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    create(): void {
        this.container = this.scene.add.container(0, 0).setDepth(91).setScrollFactor(0)

        // Header bar
        const headerBg = this.scene.add.graphics()
        headerBg.fillStyle(0x101820, 0.88)
        headerBg.fillRoundedRect(LB_X, LB_Y, 170, 18, { tl: 6, tr: 6, bl: 0, br: 0 })
        this.container.add(headerBg)

        const header = this.scene.add.text(LB_X + 8, LB_Y + 2, '★ LEADERBOARD', {
            fontSize: '11px', color: '#f8d030', fontFamily: 'monospace', fontStyle: 'bold',
        })
        this.container.add(header)

        // Initial load
        this.refresh()

        // Refresh every 30s
        this.refreshTimer = this.scene.time.addEvent({
            delay: 30000, loop: true,
            callback: () => this.refresh(),
        })
    }

    async refresh(): Promise<void> {
        if (!this.container) return

        // Remove old entry objects (keep header bg + text = first 2)
        while (this.container.list.length > 2) {
            const last = this.container.list[this.container.list.length - 1] as Phaser.GameObjects.GameObject
            last.destroy()
            this.container.remove(last, true)
        }

        try {
            const lb = await playerState.getLeaderboard()
            const entries = lb.slice(0, MAX_ENTRIES)

            // Body background
            const bodyH = Math.max(entries.length * ROW_H + 6, 24)
            const bodyBg = this.scene.add.graphics()
            bodyBg.fillStyle(0x101820, 0.82)
            bodyBg.fillRoundedRect(LB_X, LB_Y + 18, 170, bodyH, { tl: 0, tr: 0, bl: 6, br: 6 })
            this.container.add(bodyBg)

            if (entries.length === 0) {
                const empty = this.scene.add.text(LB_X + 85, LB_Y + 24, 'No players yet', {
                    fontSize: '9px', color: '#667788', fontFamily: 'monospace',
                }).setOrigin(0.5, 0)
                this.container.add(empty)
                return
            }

            entries.forEach((p: any, i: number) => {
                const ry = LB_Y + 22 + i * ROW_H

                // Rank number — colored
                const rankColors = [0xf8d030, 0xb0b0b8, 0xc07838, 0xe04040]
                const rc = rankColors[i] ?? 0xe04040
                const rank = this.scene.add.text(LB_X + 10, ry, `#${i + 1}`, {
                    fontSize: '10px',
                    color: Phaser.Display.Color.IntegerToColor(rc).rgba,
                    fontFamily: 'monospace', fontStyle: 'bold',
                })
                this.container!.add(rank)

                // Username
                const name = this.scene.add.text(LB_X + 34, ry, p.username, {
                    fontSize: '10px', color: '#d0d8e0', fontFamily: 'monospace',
                })
                this.container!.add(name)

                // Level badge pill
                const lv = p.topLevel ?? 0
                const badgeCol = lvlColor(lv)
                const badge = this.scene.add.graphics()
                badge.fillStyle(badgeCol, 1)
                badge.fillRoundedRect(LB_X + 128, ry, 34, 14, 3)
                this.container!.add(badge)

                const lvText = this.scene.add.text(LB_X + 145, ry + 1, `Lv${lv}`, {
                    fontSize: '9px', color: '#000000', fontFamily: 'monospace', fontStyle: 'bold',
                }).setOrigin(0.5, 0)
                this.container!.add(lvText)
            })
        } catch {
            // silently fail
        }
    }

    destroy(): void {
        this.refreshTimer?.destroy()
        this.container?.destroy()
        this.container = undefined
    }
}
