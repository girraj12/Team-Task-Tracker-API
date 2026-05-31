import { AppError } from '../utils/AppError.js';

export const notFound = (req, res, next) => next(new AppError(404, 'NOT_FOUND', `Route ${req.originalUrl} not found`));

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Something went wrong';
  res.status(status).json({ status, code, message });
};
