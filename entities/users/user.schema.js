import Joi from 'joi';

export default Joi.object({
	id: Joi.number().integer().optional(),
	uid: Joi.string().guid().optional(),
	username: Joi.string().email(),
	email: Joi.string().email(),
	firstname: Joi.string().required(),
	lastname: Joi.string().required(),
	nicename: Joi.string().optional().default(''),
	password: Joi.string().optional().allow('').default(''),
	type: Joi.string().default('User'),
	status: Joi.string().default('Active'),
	language: Joi.string().default('en'),
	metas: Joi.alternatives().try(Joi.object()).default({}),
}).or('username', 'email');