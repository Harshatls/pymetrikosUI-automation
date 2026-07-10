import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

export type Role = 'fullAccess' | 'viewOnly' | 'createAccess';

export const BASE_URL = process.env.BASE_URL ?? 'https://auth2.tlslogistics.org';

/** Path of the PyMetrikos UI pause-ad dashboard relative to BASE_URL. */
export const PYM_DASHBOARD_PATH =
  process.env.PYM_DASHBOARD_PATH ?? '/pymetrikosui/dashboard/1/pause-ad';

interface Credentials {
  email: string | undefined;
  password: string | undefined;
}

const CREDS: Record<Role, Credentials> = {
  fullAccess: {
    email: process.env.FULL_ACCESS_EMAIL,
    password: process.env.FULL_ACCESS_PASSWORD,
  },
  viewOnly: {
    email: process.env.VIEW_ONLY_EMAIL,
    password: process.env.VIEW_ONLY_PASSWORD,
  },
  createAccess: {
    email: process.env.CREATE_ACCESS_EMAIL,
    password: process.env.CREATE_ACCESS_PASSWORD,
  },
};

export function hasCreds(role: Role): boolean {
  const c = CREDS[role];
  return Boolean(c.email && c.password);
}

export function credsFor(role: Role): { email: string; password: string } {
  const c = CREDS[role];
  if (!c.email || !c.password) {
    throw new Error(
      `Missing credentials for role "${role}". Set the matching *_EMAIL / *_PASSWORD vars in .env (see .env.example).`,
    );
  }
  return { email: c.email, password: c.password };
}

/** storageState file for a logged-in role, produced by tests/auth.setup.ts */
export function authFile(role: Role): string {
  return path.resolve(__dirname, '..', '.auth', `${role}.json`);
}
