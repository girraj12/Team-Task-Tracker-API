import { AppError } from '../utils/AppError.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) throw new AppError(400, 'VALIDATION_ERROR', error.details.map(d => d.message).join(', '));
  req[source] = value;
  next();
};
