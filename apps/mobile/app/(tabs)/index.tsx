import { DrawerContent } from '@/components/chat-drawer';

/** Navigation is the home surface; there is no bottom tab bar. */
export default function ChatHomeScreen() {
  return <DrawerContent close={() => {}} />;
}
