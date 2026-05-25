import jwt, { SignOptions } from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRY: string = process.env.JWT_EXPIRY || '7d';

export const generateToken = (payload: any): string => {
  const options: SignOptions = { expiresIn: JWT_EXPIRY as any };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  return await bcryptjs.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcryptjs.compare(password, hash);
};

export const generateBookingReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRX-${timestamp}-${random}`;
};
