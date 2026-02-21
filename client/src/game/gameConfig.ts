import Phaser from 'phaser'
import BedroomScene       from './scenes/BedroomScene'
import HouseInteriorScene from './scenes/HouseInteriorScene'
import OutdoorScene       from './scenes/OutdoorScene'
import LabInteriorScene   from './scenes/LabInteriorScene'
import RivalHouseScene    from './scenes/RivalHouseScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#111111',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false },
    },
    // ── Responsive scaling ───────────────────────────────────────────────────
    // The logical canvas is 800×576. Phaser will scale it up/down to fill the
    // browser window while keeping aspect ratio, centered on all devices.
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width:      800,
        height:     576,
        parent:     'phaser-container',
    },
    scene: [
        BedroomScene,
        HouseInteriorScene,
        OutdoorScene,
        LabInteriorScene,
        RivalHouseScene,
    ],
}
