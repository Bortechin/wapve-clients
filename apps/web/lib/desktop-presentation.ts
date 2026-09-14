import { cookies } from 'next/headers';
import { DESKTOP_PRESENTATION_COOKIE } from './desktop-route';

export async function isDesktopPresentation(): Promise<boolean> {
  return (await cookies()).get(DESKTOP_PRESENTATION_COOKIE)?.value === '1';
}
