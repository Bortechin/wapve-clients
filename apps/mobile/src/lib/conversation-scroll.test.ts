import { beforeEach, expect, it } from '@jest/globals';
import {
  clearConversationScroll,
  conversationScroll,
  rememberConversationScroll,
} from './conversation-scroll';
beforeEach(clearConversationScroll);
it('isolates accounts and ignores invalid offsets', () => {
  rememberConversationScroll('alice:direct:one', 750);
  rememberConversationScroll('alice:direct:one', NaN);
  expect(conversationScroll('alice:direct:one')).toBe(750);
  expect(conversationScroll('bob:direct:one')).toBe(0);
});
it('bounds memory and clamps overscroll', () => {
  for (let index = 0; index < 101; index++) rememberConversationScroll(String(index), 30);
  expect(conversationScroll('0')).toBe(0);
  rememberConversationScroll('100', -50);
  expect(conversationScroll('100')).toBe(0);
});
