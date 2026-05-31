import Joi from 'joi';

export const registerSchema = Joi.object({
  organizationName: Joi.string().min(2).max(120).required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshSchema = Joi.object({ refreshToken: Joi.string().required() });
