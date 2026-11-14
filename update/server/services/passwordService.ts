import crypto from 'node:crypto';

export class PasswordService {
  private static readonly KEY_LEN = 64;
  private static readonly COST = 16384;
  private static readonly BLOCK_SIZE = 8;
  private static readonly PARALLELISM = 1;

  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, this.KEY_LEN, {
      N: this.COST,
      r: this.BLOCK_SIZE,
      p: this.PARALLELISM
    });
    return `$scrypt$N=${this.COST},r=${this.BLOCK_SIZE},p=${this.PARALLELISM}$${salt}$${derivedKey.toString('hex')}`;
  }

  public static verifyPassword(password: string, hashString: string): boolean {
    if (!hashString) return false;

    // Direct plain-text comparison fallback (for unhashed seed strings in test environments)
    if (!hashString.startsWith('$scrypt$')) {
      const bufferA = Buffer.from(password);
      const bufferB = Buffer.from(hashString);
      if (bufferA.length !== bufferB.length) return false;
      return crypto.timingSafeEqual(bufferA, bufferB);
    }

    const parts = hashString.split('$');
    // Expected format: ["", "scrypt", "N=16384,r=8,p=1", salt, hash]
    if (parts.length !== 5) return false;

    const salt = parts[3];
    const expectedHash = Buffer.from(parts[4], 'hex');

    const derivedKey = crypto.scryptSync(password, salt, expectedHash.length, {
      N: this.COST,
      r: this.BLOCK_SIZE,
      p: this.PARALLELISM
    });

    if (derivedKey.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedHash);
  }
}
