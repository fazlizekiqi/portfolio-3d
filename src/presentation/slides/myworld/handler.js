import { goToWhiteWorld } from '../../../transition.js';
import { audio } from '../../../audio.js';
import { showExploreUI, hideCard, showCard } from '../../ui.js';
import { hideBubbles } from '../bubbles-shared.js';
import { hideHowIWorkOverlay } from '../mindset/how-i-work-view.js';

export default {
    onUI(ctx) {
        hideCard();
        hideBubbles();
        hideHowIWorkOverlay();
        showCard(ctx.slide.title, ctx.slide.body, ctx.MYWORLD_CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
    },
    onEnter(ctx) {
        showExploreUI();
        ctx.setFrozen(false);
        ctx.scheduleTimeout('cta', () => {
            ctx.setFrozen(true);
            audio.playIrisWhoosh();
            audio.stopAmbient(1.0);
            goToWhiteWorld();
            ctx.endFromCta();
        }, ctx.MYWORLD_IRIS_DELAY_MS);
    },
};
