import primate from '@thewebchimp/primate';
import '#utils/typedef.js';

import { router as whatsapp } from '#routes/whatsapp.js';
import { router as ai } from '#routes/ai.js';
import {router as jb } from '#routes/juno-bitso.js';

await primate.setup();
await primate.start();

primate.app.use('/whatsapp', whatsapp);
primate.app.use('/ai', ai);
primate.app.use('/jb', jb);
