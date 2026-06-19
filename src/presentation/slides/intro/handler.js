import { cancelIdleLoop, playFeaturedClip, playClip, modelGroup, spawnRotation } from '../../../character/model.js';
import { enableHeadLook } from '../../../character/head-look.js';
import { hideAboutWireframe } from '../about/about-view.js';

export default {
    onAnimation() {
        cancelIdleLoop();
        if (modelGroup) modelGroup.rotation.copy(spawnRotation);
        hideAboutWireframe();
        // Play waving fully, then enable head-look and settle into idle
        playFeaturedClip('waving', 0.45, () => {
            enableHeadLook();
            playClip('idle');
        });
    },
};
