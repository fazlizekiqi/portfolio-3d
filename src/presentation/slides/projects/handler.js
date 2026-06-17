import { showProjectBubbles } from './project-cards.js';
import { hideCard, showCard } from '../../ui.js';
import { hideBubbles } from '../bubbles-shared.js';
import { hideHowIWorkOverlay } from '../mindset/how-i-work-view.js';

export default {
    onUI(ctx) {
        hideCard();
        hideBubbles();
        showProjectBubbles();
        hideHowIWorkOverlay();
        showCard(ctx.slide.title, ctx.slide.body, ctx.CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
    },
};
