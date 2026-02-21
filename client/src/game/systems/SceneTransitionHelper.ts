import Phaser from 'phaser'

export function transitionTo(
    scene: Phaser.Scene,
    key: string,
    data?: Record<string, unknown>,
) {
    scene.cameras.main.fadeOut(250, 0, 0, 0)
    scene.cameras.main.once('camerafadeoutcomplete', () => {
        scene.scene.start(key, data)
    })
}

export function fadeIn(scene: Phaser.Scene) {
    scene.cameras.main.fadeIn(250, 0, 0, 0)
}
