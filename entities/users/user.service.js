import primate, { jwt, PrimateService } from '@thewebchimp/primate';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import moment from 'moment-timezone';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import hbs from 'handlebars';
import MandrillService from '#services/mandrill.service.js';
moment.locale('es');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UserService {

	static async findByEmail(email) {
		try {
			return await primate.prisma.user.findUnique({
				where: {
					email,
				},
			});
		} catch(e) {
			throw e;
		}
	}

	/**
	 * Creates a new user with the given data.
	 *
	 * @param {Object} data - The data for the new user.
	 * @returns {Promise<Object>} - A promise that resolves to the created user object.
	 */
	static async create(data) {
		try {
			// Business Logic

			if(data.password) data.password = bcrypt.hashSync(data.password, 8);

			// if we receive username or email, we use one as the other
			if(data.username && !data.email) data.email = data.username;
			else if(data.email && !data.username) data.username = data.email;

			// If we receive firstname or lastname, we use them to create nicename
			if(data.firstname && data.lastname) data.nicename = data.firstname + ' ' + data.lastname;

			// check if we receive phone and put it in the metas
			if(data.phone) {
				data.metas = { phone: data.phone };
			}

			delete data.phone;

			// Primate Create
			return PrimateService.create('user', data);
		} catch(e) {
			throw e;
		}
	}

	/**
	 * Updates a user with the given data.
	 *
	 * @param {number} id - The ID of the user to update.
	 * @param {Object} data - The data to update the user with.
	 * @param {Object} [options={}] - Additional options for updating the user.
	 * @returns {Promise<Object>} - A promise that resolves to the updated user object.
	 */
	static async update(id, data, options = {}) {

		if(data.password) data.password = bcrypt.hashSync(data.password, 8);
		else delete data.password;

		return PrimateService.update('user', id, data);
	}

	/**
	 * @typedef {Object} UserLoginResponse
	 * @property {User} user - The logged-in user object.
	 * @property {string} accessToken - The access token for the user.
	 */

	/**
	 * Logs in a user with the given data.
	 *
	 * @param {Object} data - The login data containing username and password.
	 * @returns {Promise<UserLoginResponse>} - A promise that resolves to the logged-in user object with an access token.
	 * @throws {Error} - Throws an error if the login or password is missing, or if the user is not found or unauthorized.
	 */
	static async login(data) {
		const { username, password } = data;

		if(!username || !password) throw Error('Missing login or password');

		/** @type {User} */
		const user = await primate.prisma.user.findUnique({
			where: { username },
		});

		if(!user) throw Error('User not registered');

		// Check user is active
		if(user.status !== 'Active') throw Error('User is not active');

		const checkPassword = bcrypt.compareSync(password, user.password);
		if(!checkPassword) throw Error('Email address or password not valid');
		delete user.password;

		const accessToken = await jwt.signAccessToken(user);

		return { user, accessToken };
	}

	/**
	 * Initiates the account recovery process for a user.
	 *
	 * This method handles the account recovery process by receiving the user's email.
	 * It attempts to find the user associated with the provided email and sends a recovery email with a link
	 * containing a recovery token. If the email is not provided or if any error occurs, it throws an error.
	 *
	 * @param {string} email - The email of the user requesting account recovery.
	 * @returns {Promise<void>} - A promise that resolves when the recovery email is sent.
	 * @throws {Error} - Throws an error if the user is not found or if any other error occurs.
	 */
	static async recoverAccount(email) {

		/** @type {User} */
		const user = await primate.prisma.user.findUnique({
			where: { email },
		});

		if(!user) throw new Error('User not found');

		// generate to
		const to = [
			{
				email: user.email,
				name: user.nicename,
				type: 'to',
			},
		];

		// base 64 encode the user id, current timestamp and a random number
		const key = Buffer.from(`${ user.id }-${ Date.now() }-${ Math.random() }`).toString('base64');

		const token = await jwt.signAccessToken({
			idUser: user.id,
			type: 'magic',
			expiresIn: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
		});

		await primate.prisma.link.create({
			data: {
				type: 'recover',
				token: key,
				idUser: user.id,
			},
		});

		const file = fs.readFileSync(path.resolve(__dirname, '../../assets/templates/recover.hbs'), 'utf8');
		const template = hbs.compile(file);
		const html = template({
			firstname: user.firstname,
			link: `${ process.env.CLIENT_URL }/recover/?k=${ key }&t=${ token }`,
		});

		const logo = fs.readFileSync(path.resolve(__dirname, '../../assets/images/logo.png'), 'base64');

		const message = {
			from_email: 'no-reply@iki.mx',
			from_name: 'Iki - Find your center',
			to,
			html,
			subject: 'Tu link de recuperación está aquí',
			images: [
				{
					name: 'logo',
					type: 'image/png',
					content: logo,
				},
			],
		};

		return await MandrillService.sendMessage(message);
	}

	/**
	 * Validates a recovery token.
	 *
	 * This method checks the provided recovery token and key to validate the user's recovery request.
	 * If the token and key are valid, it retrieves the user associated with the token and generates
	 * a new access token for the user. If the token or key is invalid, expired, or if any error occurs,
	 * it sends the appropriate error response.
	 *
	 * @param {string} key - The recovery key.
	 * @param {string} token - The recovery token.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the user data and a new access token.
	 * @throws {Error} - Throws an error if the link is not found, the token is expired, or the token is invalid.
	 */
	static async validateRecoveryToken(key, token) {
		const link = await primate.prisma.link.findFirst({
			where: {
				token: key,
				type: 'recover',
			},
		});

		if(!link) throw Error('Link not found');

		let payload = await jwt.verifyAccessToken(token);
		payload = payload.payload;

		// check if expired
		if(new Date(payload.expiresIn) < new Date()) {

			// update link status to expired
			await primate.prisma.link.update({
				where: {
					id: link.id,
				},
				data: {
					status: 'Expired',
				},
			});

			throw Error('Token expired');
		}

		if(parseInt(payload.idUser) !== parseInt(link.idUser)) {
			throw Error('Invalid token');
		}

		// get user
		const user = await primate.prisma.user.findUnique({
			where: { id: link.idUser },
		});

		const accessToken = await jwt.signAccessToken(user);
		return { user, accessToken };
	}

	static async verifyUserExistence(idWa) {
		try {
			console.log(primate.prisma);

			const user = await primate.prisma.user.findFirst({ where: { idWa } });
			if(!user) return null;

			return user;
		} catch(e) {
			throw e;
		}
	}

	static async registerUserForFirstTime(idWa, data) {
		try {
			// Business Logic
			data.idWa = idWa;
			data.email = idWa;

			// Primate Create
			return await UserService.create(data);
		} catch(e) {
			throw e;
		}
	}
}

export default UserService;