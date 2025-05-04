import { auth, Primate } from '@thewebchimp/primate';
import AIController from '#controllers/ai.controller.js';

const router = Primate.getRouter();

router.post('/resolve-check', AIController.resolveCheck);

export { router };