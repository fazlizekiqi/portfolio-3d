import { showSkillBubbles } from './skill-bubbles.js';
import { startOrbitSweep, startCameraMove } from '../../camera.js';
import { hideCard, showCard } from '../../ui.js';
import { hideBubbles } from '../bubbles-shared.js';
import { hideHowIWorkOverlay } from '../mindset/how-i-work-view.js';
import { enableHeadLook } from '../../../character/head-look.js';

export default {
    onCamera(ctx) {
        startOrbitSweep(ctx.target.clone(), 1300, () => {
            ctx.setCamMoveDuration(1200);
            startCameraMove(ctx.pos, ctx.target);
        });
    },
    onUI(ctx) {
        hideCard();
        hideBubbles();
        showSkillBubbles();
        hideHowIWorkOverlay();
        showCard(ctx.slide.title, ctx.slide.body, ctx.CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
    },
    onEnter() {
        enableHeadLook();
    },
};
