import introHandler      from './intro/handler.js';
import skillsHandler     from './skills/handler.js';
import projectsHandler   from './projects/handler.js';
import mindsetHandler    from './mindset/handler.js';
import experienceHandler from './experience/handler.js';
import aboutHandler      from './about/handler.js';
import ctaHandler        from './cta/handler.js';
import myworldHandler    from './myworld/handler.js';

const _handlers = {
    intro:      introHandler,
    skills:     skillsHandler,
    projects:   projectsHandler,
    mindset:    mindsetHandler,
    experience: experienceHandler,
    about:      aboutHandler,
    cta:        ctaHandler,
    myworld:    myworldHandler,
};

export function getHandler(name) { return _handlers[name] ?? {}; }
