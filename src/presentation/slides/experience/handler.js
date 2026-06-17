import { cancelIdleLoop, playClip, playFeaturedClip, playClipSequence, modelGroup, spawnRotation } from '../../../character/model.js';
import { hideAboutWireframe } from '../about/about-view.js';
import { hideCard, showCard } from '../../ui.js';
import { hideBubbles } from '../bubbles-shared.js';
import { hideHowIWorkOverlay } from '../mindset/how-i-work-view.js';

export default {
    onAnimation(ctx) {
        cancelIdleLoop();
        if (modelGroup) modelGroup.rotation.y = spawnRotation.y + 0.62;
        hideAboutWireframe();
        const { clip, clips, loop } = ctx.slide.anim;
        if (loop)              playClip(clip);
        else if (clips?.length > 1) playClipSequence(clips);
        else                   playFeaturedClip(clip);
    },
    onUI(ctx) {
        hideCard();
        hideBubbles();
        hideHowIWorkOverlay();
        ctx.setExpDoneListener(() => ctx.goToNext());
        showCard(ctx.slide.title, ctx.slide.body, ctx.CARD_DELAY_MS, ctx.name, ctx.slide.subtitle ?? '');
    },
};
