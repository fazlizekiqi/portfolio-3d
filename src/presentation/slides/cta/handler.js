import { isMobile } from '../../../constants.js';
import { tickCtaLayout } from './cta-view.js';

export default {
    tick() {
        if (!isMobile()) tickCtaLayout();
    },
};
