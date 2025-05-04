import { auth, Primate } from '@thewebchimp/primate';

const router = Primate.getRouter();

router.post('/resolve-check', AIController.resolveCheck);

export { router };