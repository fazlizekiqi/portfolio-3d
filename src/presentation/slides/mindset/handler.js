import { showHowIWorkOverlay, tickHowIWorkOverlay } from './how-i-work-view.js';
import { cancelIdleLoop, playClip, playFeaturedClip, modelGroup, spawnRotation } from '../../../character/model.js';
import { hideAboutWireframe } from '../about/about-view.js';
import { hideCard, showCard } from '../../ui.js';
import { hideBubbles } from '../bubbles-shared.js';

export default {
    onAnimation(ctx) {
        cancelIdleLoop();
        if (modelGroup) modelGroup.rotation.copy(spawnRotation);
        hideAboutWireframe();
        playFeaturedClip('ide-to-walk', 0.45, () => {
            playClip('walking', 1.0, 0.5);
        });
    },
    onUI(ctx) {
        hideCard();
        hideBubbles();
        ctx.scheduleTimeout('overlay', () => {
            showHowIWorkOverlay(ctx.slide.duration - ctx.MINDSET_OVERLAY_DELAY_MS);
        }, ctx.MINDSET_OVERLAY_DELAY_MS);
        showCard(ctx.slide.title, '', ctx.CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
    },
    tick: (delta) => tickHowIWorkOverlay(delta),
};
