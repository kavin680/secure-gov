import {
  hashPassword,
  comparePassword,
  generateToken,
  generateOtp,
} from './hash.util';

describe('Hash Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await hashPassword('Test@12345', 4);
      expect(hash).toBeDefined();
      expect(hash).not.toBe('Test@12345');
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should use default rounds when not specified', async () => {
      const hash = await hashPassword('Test@12345');
      expect(hash).toBeDefined();
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const hash = await hashPassword('Test@12345', 4);
      const result = await comparePassword('Test@12345', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await hashPassword('Test@12345', 4);
      const result = await comparePassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a hex token of default length', () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate a token of specified length', () => {
      const token = generateToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateOtp', () => {
    it('should generate a numeric OTP of default length', () => {
      const otp = generateOtp();
      expect(otp.length).toBe(6);
      expect(/^\d+$/.test(otp)).toBe(true);
    });

    it('should generate an OTP of specified length', () => {
      const otp = generateOtp(8);
      expect(otp.length).toBe(8);
      expect(/^\d+$/.test(otp)).toBe(true);
    });
  });
});
