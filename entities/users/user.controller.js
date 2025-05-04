import sharp from 'sharp';
import queryString from 'query-string';
import primate, { PrimateService, PrimateController, jwt } from '@thewebchimp/primate';
import UserService from '#entities/users/user.service.js';
import UploadService from '#services/upload.service.js';
import bcrypt from 'bcrypt';

class UserController extends PrimateController {

	/**
	 * Retrieves the user information based on the provided parameter ID.
	 *
	 * If the parameter ID is 'me', it retrieves the authenticated user's information.
	 * Otherwise, it retrieves the user information based on the provided ID.
	 *
	 * @param {Object} req - The request object.
	 * @param {string} paramId - The parameter ID to retrieve the user information.
	 * @returns {Promise<Object>} The user information.
	 * @throws {Error} If the user is not authenticated or not found.
	 */
	static async getMe(req, paramId = '') {

		// if paramId is not a string or integer, throw error
		if(typeof paramId !== 'string' && typeof paramId !== 'number') throw new Error('Invalid user id');

		let signedUserId = paramId;

		if(paramId === 'me' || !paramId) {

			if(!req.user || !req.user.payload || !req.user.payload.id) {
				throw new Error('Unauthorized: No user found');
			}

			// Get user from req
			signedUserId = req.user.payload.id;
		}

		if(!signedUserId) throw new Error('Unauthorized: No user found');

		/** @type {User} */
		const user = await PrimateService.findById('user', signedUserId);

		if(!user) throw new Error('User not found');

		// delete password
		delete user.password;

		return user;
	}

	/**
	 * Bypasses Google login for a user with the given data.
	 *
	 * This method handles the Google login bypass process. It receives the username, first name, and last name from the request body,
	 * checks if the user exists, and creates a new user if not. It then generates an access token for the user and returns the user data.
	 *
	 * @param {Object} req - The request object containing the username, first name, and last name in the body.
	 * @param {Object} res - The response object used to send back the user data with access token or error message.
	 * @returns {Promise<void>} - A promise that resolves when the response is sent.
	 */
	static async googleByPass(req, res) {
		try {
			const email = req.body.email;
			const displayName = req.body.displayName;
			const id = req.body.id;
			const photoUrl = req.body.photoUrl;

			if(!email) {
				return res.respond({
					status: 400,
					message: 'Missing email',
				});
			}

			const { user, accessToken } = await UserService.googleByPass({
				email,
				displayName,
				id,
				photoUrl,
			});

			return res.respond({
				data: user,
				message: 'User logged successfully',
				props: { accessToken },
			});

		} catch(e) {
			console.error(e);

			let message = 'Error logging in with Google: ' + e.message;

			return res.respond({
				status: 400,
				message,
			});
		}
	};

	/**
	 * Updates the profile information for a user.
	 *
	 * This method handles the process of updating a user's profile information. It first checks if the user is authenticated
	 * and retrieves the current user from the database. It then updates the user's information with the provided data.
	 * If the user ID is 'me', it uses the authenticated user's ID instead.
	 *
	 * @param {Object} req - The request object containing the user ID in the parameters and the profile information in the body.
	 * @param {Object} res - The response object used to send back the updated user data or error message.
	 * @returns {Promise<void>} - Returns a promise that resolves to void.
	 * @throws {Error} - Throws an error if the user is not found or if there is an issue updating the profile.
	 */
	static async updateProfile(req, res) {
		try {
			const idUser = req.params.id;

			if(idUser === 'me') {
				if(!req.user || !req.user.payload || !req.user.payload.id) {
					return res.respond({ status: 401, message: 'Unauthorized' });
				}
				req.params.id = req.user.payload.id;
			}

			// get current user
			/** @type {User} */
			const currentUser = await PrimateService.findById('user', req.params.id);
			if(!currentUser) throw new Error('User not found');

			const userInfo = { ...currentUser, ...req.body };

			const user = await UserService.update(req.params.id, userInfo);

			return res.respond({
				data: user,
				message: 'User updated successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'User update error: ' + e.message });
		}
	}

	/**
	 * Retrieves the authenticated user's information.
	 *
	 * This method checks for the presence of an authenticated user in the request object.
	 * If the user is authenticated, it fetches the user data from the database, removes
	 * the password for security, and sends the user data in the response. If the user is
	 * not authenticated or if any error occurs, it sends the appropriate error response.
	 *
	 * @param {Object} req - The request object.
	 * @param {Object} res - The response object.
	 * @returns {void}
	 */
	static async me(req, res) {
		try {
			if(!req.user || !req.user.payload || !req.user.payload.id) {
				return res.respond({ status: 401, message: 'Unauthorized' });
			}

			// Get user from req
			const signedUser = req.user.payload;

			/** @type {User} */
			const user = await PrimateService.findById('user', signedUser.id);

			if(!user) {
				return res.respond({ status: 404, message: 'User not found' });
			}

			// delete password
			delete user.password;

			return res.respond({
				data: user,
				message: 'User retrieved successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'User me error: ' + e.message });
		}
	};

	/**
	 * Edits the profile information for a user.
	 *
	 * This method retrieves the user information based on the provided parameter ID.
	 * If the parameter ID is 'me', it retrieves the authenticated user's information.
	 * Otherwise, it retrieves the user information based on the provided ID.
	 * It then updates the user's profile with the provided data.
	 *
	 * @param {Object} req - The request object containing the user ID in the parameters and the profile information in the body.
	 * @param {Object} res - The response object used to send back the updated user data or error message.
	 * @returns {Promise<void>} - A promise that resolves when the response is sent.
	 * @throws {Error} If the user is not authenticated or not found.
	 */
	static async editProfile(req, res) {
		try {
			const user = await UserController.getMe(req, req.params.id);
			if(!user) throw new Error('User not found');

			const body = {
				...req.body,
				metas: { ...user.metas, ...req.body.metas },
			};

			// receive gender
			const gender = req.body.gender;
			if(gender) body.metas.gender = gender;

			// receive birthdate
			let dateOfBirth = req.body.dateOfBirth;
			if(dateOfBirth) body.metas.dateOfBirth = dateOfBirth;

			const updatedUser = await UserService.update(user.id, body);

			return res.respond({
				data: updatedUser,
				message: 'User updated successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'User update error: ' + e.message });
		}
	}

	static async editPassword(req, res) {
		try {
			const user = await UserController.getMe(req, req.params.id);
			if(!user) throw new Error('User not found');

			if(!req.body.password) throw new Error('Password is required');

			const updatedUser = await UserService.update(user.id, {
				password: req.body.password,
			});

			return res.respond({
				data: updatedUser,
				message: 'User updated successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'User update error: ' + e.message });
		}
	}

	/**
	 * Registers a new user.
	 *
	 * This method handles the registration of a new user. It receives user details from the request body,
	 * attempts to create a new user with these details, and logs the event if the user creating the request
	 * is already authenticated. It responds with the newly created user data or an error message if the
	 * registration fails due to validation errors or if the username already exists.
	 *
	 * @param {Object} req - The request object containing user details in the body.
	 * @param {Object} res - The response object used to send back the created user data or error message.
	 * @returns {void}
	 */
	static async register(req, res) {
		try {
			delete req.body.passwordConfirmation;

			/** @type {User} */
			const user = await UserService.create(req.body);

			return res.respond({
				data: user,
				message: 'User created successfully',
			});

		} catch(e) {
			let message = 'Error creating user: ' + e.message;

			if(e.code === 'P2002') {
				message = 'Error creating user: Username already exists';
			}

			return res.respond({
				status: 400,
				message,
			});
		}
	};

	/**
	 * Logs in a user.
	 *
	 * This method authenticates a user by their username and password. It first validates the provided credentials,
	 * then checks if the user exists and if the password matches the stored hash. If authentication is successful,
	 * it generates an access token for the user, resolves their permissions based on their user type, and returns
	 * the user data along with the access token. If the user does not exist, or if the password does not match,
	 * it responds with an error message.
	 *
	 * @param {Object} req - The request object containing login credentials in the body.
	 * @param {Object} res - The response object used to send back the user data with access token or error message.
	 * @returns {void}
	 */
	static async login(req, res) {
		try {
			const { user, accessToken } = await UserService.login(req.body);

			return res.respond({
				data: user,
				message: 'Account login successful',
				props: { accessToken },
			});

		} catch(e) {
			console.error(e);
			return res.respond({
				status: 400,
				message: 'Error login user: ' + e.message,
			});
		}
	};

	/**
	 * Returns the avatar image for a user if it exists, or generates an avatar based on the user's first name and last name.
	 *
	 * This method retrieves the user's avatar from the database if it exists. If the avatar does not exist, it generates
	 * an avatar using the user's initials and returns it. The method also supports query parameters for customizing the
	 * avatar's appearance, such as size, width, height, boldness, background color, text color, font size, border, and
	 * the number of characters to display.
	 *
	 * @param {Object} req - The request object containing the user ID in the parameters and optional query parameters for avatar customization.
	 * @param {Object} res - The response object used to send back the avatar image or redirect to the generated avatar URL.
	 * @returns {void}
	 * @throws {Error} - Throws an error if the user ID is not provided or if there is an issue retrieving the user or avatar.
	 */
	static async avatar(req, res) {

		if(!req.params.id) throw new Error('No user id provided');

		// Get query params for width and height
		const {
			size = 128,
			width = 128,
			height = 128,
			bold = true,
			background = 'FFFFFF',
			color = '000000',
			fontSize = 64,
			border = 2,
			chars = 2,
			mode = 'light',
			format = 'png',
		} = req.query;

		// Set options
		const options = { size, width, height, bold, background, color, fontSize, border, chars, format };

		if(mode === 'dark') {
			options.background = '000000';
			options.color = 'FFFFFF';
		}

		// covert options to query string
		const query = queryString.stringify(options);

		try {

			/** @type {User} */
			const user = await PrimateService.findById('user', req.params.id);
			let attachment;

			// check if we got user.metas.idAvatar
			if(user.metas?.idAvatar) {
				// get the attachment
				try {

					/** @type {Attachment} */
					attachment = await PrimateService.findById('attachment', user.metas.idAvatar);

				} catch(e) {
					console.error('Error getting attachment:', e);
				}
			}

			// if we have an attachment, return the location of the attachment
			if(attachment && attachment.metas?.location) {

				res.redirect(attachment.metas.location);

			} else {

				// Get initials
				let initials = user.firstname + ' ' + user.lastname;

				// Trim initials
				initials = initials.trim();

				// if the initials are empty, use username
				if(!initials) initials = user.username;

				// if still empty, use NA
				if(!initials) initials = 'NA';

				res.redirect(`https://ui-avatars.com/api/?name=${ initials }&${ query }`);
			}
		} catch(e) {

			console.error('Error getting avatar, using fallback:', e);
			res.redirect(`https://ui-avatars.com/api/?name=NA&${ query }`);
		}
	};

	/**
	 * Updates the avatar for a user.
	 *
	 * This method handles the process of updating a user's avatar. It first checks if the user is authenticated
	 * and retrieves the current user from the database. It then processes the uploaded file, creates an attachment
	 * record, and updates the user's metadata with the new avatar ID. If the user ID is 'me', it uses the authenticated
	 * user's ID instead.
	 *
	 * @param {Object} req - The request object containing the user ID in the parameters and the file in the body.
	 * @param {Object} res - The response object used to send back the updated user data or error message.
	 * @returns {Promise<void>} - Returns a promise that resolves to void.
	 * @throws {Error} - Throws an error if the user is not found or if there is an issue updating the avatar.
	 */
	static async updateAvatar(req, res) {
		try {
			const idUser = req.params.id;

			if(idUser === 'me') {
				if(!req.user || !req.user.payload || !req.user.payload.id) {
					return res.respond({ status: 401, message: 'Unauthorized' });
				}
				req.params.id = req.user.payload.id;
			}

			// check if we received a file
			if(!req.file) return res.respond({ status: 400, message: 'No file received' });

			// Get the file from body
			const file = req.file;

			// get current user
			/** @type {User} */
			const currentUser = await PrimateService.findById('user', req.params.id);
			if(!currentUser) throw new Error('User not found');

			// Process the image to create an 800x800 avatar
			const avatarBuffer = await sharp(file.buffer)
				.resize(800, 800, { fit: 'cover' }) // Resize and crop to ensure 1:1 aspect ratio
				.toBuffer();

			// Store the original and the avatar as separate attachments
			const originalAttachment = await UploadService.createAttachment(file);

			const avatarAttachment = await UploadService.createAttachment({
				buffer: avatarBuffer,
				size: avatarBuffer.length,
				originalname: `avatar-${ file.originalname }`,
				mimetype: file.mimetype,
			}, { metas: { type: 'avatar', originalAttachment: originalAttachment.id } });

			// Update the user metadata with references to the original and avatar attachments
			const updatedUser = await UserService.update(req.params.id, {
				metas: {
					...currentUser.metas,
					idAvatar: avatarAttachment.id,
					idAvatarOriginal: originalAttachment.id,
				},
			});

			return res.respond({
				data: {
					user: updatedUser,
					avatar: avatarAttachment,
					original: originalAttachment,
				},
				message: 'User avatar updated successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'User avatar update error: ' + e.message });
		}
	}

	/**
	 * Initiates the account recovery process for a user.
	 *
	 * This method handles the account recovery process by receiving the user's email from the request body.
	 * It attempts to find the user associated with the provided email and sends a recovery email with a link
	 * containing a recovery token. If the email is not provided or if any error occurs, it sends the appropriate
	 * error response.
	 *
	 * @param {Object} req - The request object containing the user's email in the body.
	 * @param {Object} res - The response object used to send back the success message or error message.
	 * @returns {void}
	 */
	static async recoverAccount(req, res) {
		try {
			const { email } = req.body;

			if(!email) {
				return res.respond({
					status: 400,
					message: 'Email is required',
				});
			}

			const user = await UserService.recoverAccount(email);

			if(!user) {
				return res.respond({
					status: 404,
					message: 'User not found',
				});
			}

			return res.respond({
				data: user,
				message: 'Account recovery successful',
			});

		} catch(e) {
			console.error('Error recovering account:', e);
			return res.respond({
				status: 400,
				message: e.message,
			});
		}
	}

	/**
	 * Validates a recovery token.
	 *
	 * This method checks the provided recovery token and key to validate the user's recovery request.
	 * If the token and key are valid, it retrieves the user associated with the token and generates
	 * a new access token for the user. If the token or key is invalid, expired, or if any error occurs,
	 * it sends the appropriate error response.
	 *
	 * @param {Object} req - The request object containing the recovery token and key in the body.
	 * @param {Object} res - The response object used to send back the user data with access token or error message.
	 * @returns {void}
	 */
	static async validateRecoveryToken(req, res) {
		try {
			const { token } = req.body;

			if(!token) {
				return res.respond({
					status: 400,
					message: 'Token is required',
				});
			}

			const { user, accessToken } = await UserService.validateRecoveryToken(req.body.key, req.body.token);

			if(!user) {
				return res.respond({
					status: 404,
					message: 'User not found',
				});
			}

			return res.respond({
				data: user,
				message: 'Token validated successfully',
				props: { accessToken },
			});

		} catch(e) {
			console.error('Error validating token:', e);
			return res.respond({
				status: 400,
				message: e.message,
			});
		}
	}

	/**
	 * Initiates a chat for the authenticated user.
	 *
	 * This method validates the authenticated user from the request object.
	 * If the user is authenticated, it checks if a chat exists for the user.
	 * If a chat does not exist, it creates a new chat. It then creates a thread
	 * for the chat or retrieves the existing thread. Finally, it retrieves all
	 * messages for the thread and sends the chat and thread data in the response.
	 * If the user is not authenticated or if any error occurs, it sends the appropriate error response.
	 *
	 * @param {Object} req - The request object containing the authenticated user's information.
	 * @param {Object} res - The response object used to send back the chat and thread data or an error message.
	 * @returns {Promise<void>} - A promise that resolves when the chat has been initiated and the response has been sent.
	 * @throws {Error} - Throws an error if there is an issue initiating the chat.
	 */
	static async initChat(req, res) {
		const user = await UserController.getMe(req);
		if(!user) return res.respond({ status: 401, message: 'User not found or error fetching user' });

		// get entity and idEntity from body
		let { entity, idEntity } = req.body;
		if(!entity || !idEntity) return res.respond({ status: 400, message: 'Entity and idEntity are required' });

		// convert idEntity to integer
		if(!isNaN(idEntity)) idEntity = parseInt(idEntity);

		try {
			// check if a chat exists for the user
			let chat = await PrimateService.findBy('chat', { idUser: user.id, entity, idEntity });
			if(!chat) chat = await PrimateService.create('chat', { idUser: user.id, entity, idEntity });

			// now create a thread for the chat or retrieve the existing thread
			let thread = await PrimateService.findBy('thread', { idChat: chat.id });
			if(!thread) thread = await PrimateService.create('thread', { idChat: chat.id, idUser: user.id });

			// now get all the messages for the thread
			thread.messages = await PrimateService.all('message', {
				idThread: thread.id,
				idChat: chat.id,
				idUser: user.id,
			});
			thread.messages = thread.messages.data;

			// reordering messages from oldest to newest
			thread.messages.sort((a, b) => new Date(a.created) - new Date(b.created));

			return res.respond({
				data: {
					chat,
					thread,
				},
				message: 'Chat initiated successfully',
			});

		} catch(e) {
			console.error(e);
			return res.respond({ status: 400, message: 'Error initiating chat: ' + e.message });
		}
	}
}

export default UserController;
