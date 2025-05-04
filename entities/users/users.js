import { auth, Primate } from '@thewebchimp/primate';
import UserController from './user.controller.js';
import multer from 'multer';

const router = Primate.getRouter();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// me
router.get('/me', auth, UserController.me);

// register a new user
router.post('/register', UserController.register);

// login
router.post('/login', UserController.login);

// get user avatar
router.get('/:id/avatar', UserController.avatar);

// update user avatar
router.put('/:id/avatar', auth, upload.single('file'), UserController.updateAvatar);

// Recover account
router.post('/recover', UserController.recoverAccount);
router.post('/recover/validate', UserController.validateRecoveryToken);

Primate.setupRoute('user', router, {
	searchField: [ 'username' ],
	queryableFields: [ 'nicename', 'email' ],
});
export { router };
