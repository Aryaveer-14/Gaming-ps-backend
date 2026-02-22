import Phaser from 'phaser'
import BootScene            from './scenes/BootScene'
import BedroomScene         from './scenes/BedroomScene'
import HouseInteriorScene   from './scenes/HouseInteriorScene'
import OutdoorScene         from './scenes/OutdoorScene'
import LabInteriorScene     from './scenes/LabInteriorScene'
import RivalHouseScene      from './scenes/RivalHouseScene'
import Route1Scene          from './scenes/Route1Scene'
import ViridianCityScene    from './scenes/ViridianCityScene'
import LegendaryCaveScene   from './scenes/LegendaryCaveScene'
import PokeCenterScene      from './scenes/PokeCenterScene'
import PokeMartScene        from './scenes/PokeMartScene'
import WildEncounterScene   from './scenes/WildEncounterScene'
import TrainerBattleScene   from './scenes/TrainerBattleScene'

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
        BootScene,          // generates all pixel-art textures first
        BedroomScene,
        HouseInteriorScene,
        OutdoorScene,
        LabInteriorScene,
        RivalHouseScene,
        Route1Scene,
        ViridianCityScene,
        LegendaryCaveScene,
        PokeCenterScene,
        PokeMartScene,
        WildEncounterScene,
        TrainerBattleScene,
    ],
}
