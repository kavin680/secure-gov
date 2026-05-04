import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export async function hashPassword(
  password: string,
  rounds = 12,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}
