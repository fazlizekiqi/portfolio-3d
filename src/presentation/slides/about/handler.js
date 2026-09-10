import { showAboutWireframe, tickAboutWireframe } from './about-view.js';
import { cancelIdleLoop, playClip, modelGroup, spawnRotation } from '../../../character/model.js';

export default {
    onAnimation(ctx) {
        cancelIdleLoop();
        if (modelGroup) modelGroup.rotation.copy(spawnRotation);
        showAboutWireframe(() => {
            cancelIdleLoop();
            playClip(ctx.slide.anim.clip, 1.0, 1.2);
        });
    },
    tick: (delta) => tickAboutWireframe(delta),
};
