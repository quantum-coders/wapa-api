import primate from '@thewebchimp/primate';
import '#utils/typedef.js';

import { router as whatsapp } from '#routes/whatsapp.js';
import { router as ai } from '#routes/ai.js';

await primate.setup();
await primate.start();

primate.app.use('/whatsapp', whatsapp);
primate.app.use('/ai', ai);