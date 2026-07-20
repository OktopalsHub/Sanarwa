import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.AUTH_SECRET,
  expiresIn: process.env.AUTH_EXPIRES_IN || '7d',
}));
