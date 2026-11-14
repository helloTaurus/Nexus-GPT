/**
 * Pure TypeScript Zero-Dependency Schema Validation (Zod-compatible API)
 * Neutralizes supply-chain vulnerabilities, external registry drift, and installation issues.
 */

export interface Issue {
  path: (string | number)[];
  message: string;
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { errors: Issue[]; issues: Issue[]; message: string } };

export abstract class ZodType<T = any> {
  public isOptional: boolean = false;
  public isNullable: boolean = false;
  public defaultValue?: T;
  public transforms: Array<(val: any) => any> = [];

  abstract _parse(val: any, path: (string | number)[]): { success: boolean; data?: T; issues: Issue[] };

  public safeParse(val: any): SafeParseResult<T> {
    const res = this._parse(val, []);
    if (res.success) {
      let finalData = res.data as T;
      for (const t of this.transforms) {
        finalData = t(finalData);
      }
      return { success: true, data: finalData };
    }
    return {
      success: false,
      error: {
        errors: res.issues,
        issues: res.issues,
        message: res.issues[0]?.message || 'Validation failed'
      }
    };
  }

  public parse(val: any): T {
    const res = this.safeParse(val);
    if (!res.success) {
      const err = new Error(res.error.message);
      (err as any).issues = res.error.issues;
      (err as any).name = 'ZodError';
      throw err;
    }
    return res.data;
  }

  public optional(): ZodType<T | undefined> {
    this.isOptional = true;
    return this as any;
  }

  public nullable(): ZodType<T | null> {
    this.isNullable = true;
    return this as any;
  }

  public default(val: T): ZodType<T> {
    this.defaultValue = val;
    return this;
  }

  public transform<R>(fn: (val: T) => R): ZodType<R> {
    this.transforms.push(fn);
    return this as any;
  }
}

export class ZodString extends ZodType<string> {
  private minLength?: { val: number; msg?: string };
  private maxLength?: { val: number; msg?: string };
  private regexPattern?: { regex: RegExp; msg?: string };
  private isEmail: boolean = false;
  private shouldTrim: boolean = false;
  private shouldLowerCase: boolean = false;

  public min(val: number, msg?: string | { message?: string }): this {
    const message = typeof msg === 'string' ? msg : msg?.message;
    this.minLength = { val, msg: message };
    return this;
  }

  public max(val: number, msg?: string | { message?: string }): this {
    const message = typeof msg === 'string' ? msg : msg?.message;
    this.maxLength = { val, msg: message };
    return this;
  }

  public regex(regex: RegExp, msg?: string | { message?: string }): this {
    const message = typeof msg === 'string' ? msg : msg?.message;
    this.regexPattern = { regex, msg: message };
    return this;
  }

  public email(msg?: string | { message?: string }): this {
    this.isEmail = true;
    const message = typeof msg === 'string' ? msg : msg?.message;
    if (message && !this.regexPattern) {
      this.regexPattern = { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: message };
    }
    return this;
  }

  public trim(): this {
    this.shouldTrim = true;
    return this;
  }

  public toLowerCase(): this {
    this.shouldLowerCase = true;
    return this;
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: string; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) {
        return { success: true, data: this.defaultValue, issues: [] };
      }
      if (this.isOptional) {
        return { success: true, data: undefined, issues: [] };
      }
      return { success: false, issues: [{ path, message: 'Required field is missing' }] };
    }

    if (val === null) {
      if (this.isNullable) {
        return { success: true, data: null as any, issues: [] };
      }
      return { success: false, issues: [{ path, message: 'Expected string, received null' }] };
    }

    if (typeof val !== 'string') {
      return { success: false, issues: [{ path, message: `Expected string, received ${typeof val}` }] };
    }

    let parsed = val;
    if (this.shouldTrim) parsed = parsed.trim();
    if (this.shouldLowerCase) parsed = parsed.toLowerCase();

    if (this.minLength !== undefined && parsed.length < this.minLength.val) {
      return {
        success: false,
        issues: [{ path, message: this.minLength.msg || `String must contain at least ${this.minLength.val} character(s)` }]
      };
    }

    if (this.maxLength !== undefined && parsed.length > this.maxLength.val) {
      return {
        success: false,
        issues: [{ path, message: this.maxLength.msg || `String must contain at most ${this.maxLength.val} character(s)` }]
      };
    }

    if (this.isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parsed)) {
        return {
          success: false,
          issues: [{ path, message: this.regexPattern?.msg || 'Invalid email format' }]
        };
      }
    }

    if (this.regexPattern && !this.regexPattern.regex.test(parsed)) {
      return {
        success: false,
        issues: [{ path, message: this.regexPattern.msg || 'Invalid format' }]
      };
    }

    return { success: true, data: parsed, issues: [] };
  }
}

export class ZodNumber extends ZodType<number> {
  private minVal?: { val: number; msg?: string };
  private maxVal?: { val: number; msg?: string };
  private requireInt: boolean = false;
  private isCoerced: boolean = false;

  constructor(coerced = false) {
    super();
    this.isCoerced = coerced;
  }

  public min(val: number, msg?: string | { message?: string }): this {
    const message = typeof msg === 'string' ? msg : msg?.message;
    this.minVal = { val, msg: message };
    return this;
  }

  public max(val: number, msg?: string | { message?: string }): this {
    const message = typeof msg === 'string' ? msg : msg?.message;
    this.maxVal = { val, msg: message };
    return this;
  }

  public int(msg?: string | { message?: string }): this {
    this.requireInt = true;
    return this;
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: number; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) {
        return { success: true, data: this.defaultValue, issues: [] };
      }
      if (this.isOptional) {
        return { success: true, data: undefined, issues: [] };
      }
      return { success: false, issues: [{ path, message: 'Required field is missing' }] };
    }

    if (val === null) {
      if (this.isNullable) return { success: true, data: null as any, issues: [] };
      return { success: false, issues: [{ path, message: 'Expected number, received null' }] };
    }

    let parsed = val;
    if (this.isCoerced) {
      parsed = Number(val);
      if (isNaN(parsed)) {
        return { success: false, issues: [{ path, message: `Expected number, received NaN` }] };
      }
    } else if (typeof parsed !== 'number' || isNaN(parsed)) {
      return { success: false, issues: [{ path, message: `Expected number, received ${typeof val}` }] };
    }

    if (this.requireInt && !Number.isInteger(parsed)) {
      return { success: false, issues: [{ path, message: 'Expected integer' }] };
    }

    if (this.minVal !== undefined && parsed < this.minVal.val) {
      return {
        success: false,
        issues: [{ path, message: this.minVal.msg || `Number must be greater than or equal to ${this.minVal.val}` }]
      };
    }

    if (this.maxVal !== undefined && parsed > this.maxVal.val) {
      return {
        success: false,
        issues: [{ path, message: this.maxVal.msg || `Number must be less than or equal to ${this.maxVal.val}` }]
      };
    }

    return { success: true, data: parsed, issues: [] };
  }
}

export class ZodBoolean extends ZodType<boolean> {
  _parse(val: any, path: (string | number)[]): { success: boolean; data?: boolean; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue, issues: [] };
      if (this.isOptional) return { success: true, data: undefined, issues: [] };
      return { success: false, issues: [{ path, message: 'Required field is missing' }] };
    }

    if (val === null) {
      if (this.isNullable) return { success: true, data: null as any, issues: [] };
      return { success: false, issues: [{ path, message: 'Expected boolean, received null' }] };
    }

    if (typeof val !== 'boolean') {
      return { success: false, issues: [{ path, message: `Expected boolean, received ${typeof val}` }] };
    }

    return { success: true, data: val, issues: [] };
  }
}

export class ZodUnion<T extends readonly ZodType<any>[]> extends ZodType<any> {
  constructor(private options: T) {
    super();
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: any; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue, issues: [] };
      if (this.isOptional) return { success: true, data: undefined, issues: [] };
      return { success: false, issues: [{ path, message: 'Required field is missing' }] };
    }

    if (val === null) {
      if (this.isNullable) return { success: true, data: null as any, issues: [] };
    }

    for (const opt of this.options) {
      const res = opt._parse(val, path);
      if (res.success) {
        let transformed = res.data;
        for (const t of opt.transforms) {
          transformed = t(transformed);
        }
        return { success: true, data: transformed, issues: [] };
      }
    }

    return {
      success: false,
      issues: [{ path, message: 'Invalid input: does not match any union type' }]
    };
  }
}

export class ZodEnum<U extends string, T extends readonly [U, ...U[]]> extends ZodType<T[number]> {
  constructor(private values: T) {
    super();
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: T[number]; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue, issues: [] };
      if (this.isOptional) return { success: true, data: undefined, issues: [] };
      return { success: false, issues: [{ path, message: 'Required field is missing' }] };
    }

    if (this.values.includes(val)) {
      return { success: true, data: val, issues: [] };
    }

    return {
      success: false,
      issues: [{ path, message: `Invalid enum value. Expected one of: ${this.values.join(', ')}` }]
    };
  }
}

export class ZodObject<T extends Record<string, ZodType<any>>> extends ZodType<any> {
  private isStrict: boolean = false;

  constructor(private shape: T) {
    super();
  }

  public strict(): this {
    this.isStrict = true;
    return this;
  }

  _parse(val: any, path: (string | number)[]): { success: boolean; data?: any; issues: Issue[] } {
    if (val === undefined) {
      if (this.defaultValue !== undefined) return { success: true, data: this.defaultValue, issues: [] };
      if (this.isOptional) return { success: true, data: undefined, issues: [] };
      return { success: false, issues: [{ path, message: 'Required object is missing' }] };
    }

    if (typeof val !== 'object' || val === null || Array.isArray(val)) {
      return { success: false, issues: [{ path, message: `Expected object, received ${typeof val}` }] };
    }

    const issues: Issue[] = [];
    const output: any = {};

    // Check strict extra fields
    if (this.isStrict) {
      for (const k of Object.keys(val)) {
        if (!(k in this.shape)) {
          issues.push({ path: [...path, k], message: `Unrecognized key '${k}' in payload` });
        }
      }
    }

    for (const [key, schema] of Object.entries(this.shape)) {
      const fieldRes = schema._parse(val[key], [...path, key]);
      if (!fieldRes.success) {
        issues.push(...fieldRes.issues);
      } else if (fieldRes.data !== undefined) {
        let fieldData = fieldRes.data;
        for (const t of schema.transforms) {
          fieldData = t(fieldData);
        }
        output[key] = fieldData;
      }
    }

    if (issues.length > 0) {
      return { success: false, issues };
    }

    return { success: true, data: output, issues: [] };
  }
}

export type ZodInfer<T> = T extends ZodType<infer R> ? R : any;

export const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(false),
  boolean: () => new ZodBoolean(),
  union: <T extends readonly ZodType<any>[]>(options: T) => new ZodUnion(options),
  coerce: {
    number: () => new ZodNumber(true)
  },
  enum: <U extends string, T extends readonly [U, ...U[]]>(values: T) => new ZodEnum(values),
  object: <T extends Record<string, ZodType<any>>>(shape: T) => new ZodObject(shape)
};

export namespace z {
  export type infer<T> = ZodInfer<T>;
}


