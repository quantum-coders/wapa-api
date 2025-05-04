import primate from '@thewebchimp/primate';
import '#utils/typedef.js';

import { router as whatsapp } from '#routes/whatsapp.js';

await primate.setup();
await primate.start();

primate.app.use('/whatsapp', whatsapp);