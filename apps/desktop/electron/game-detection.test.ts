import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectGame, isMinecraftJava } from './game-detection.js';

test('detects only exact game processes, preserves the running game and clears on exit', () => {
  assert.equal(detectGame('"RiotClientServices.exe","1"\n"cs2.exe.bak","2"', null), null);
  const output = '"VALORANT-Win64-Shipping.exe","1"\n"cs2.exe","2"';
  assert.equal(detectGame(output, null), 'valorant');
  assert.equal(detectGame(output, 'counter-strike-2'), 'counter-strike-2');
  assert.equal(detectGame('"cs2.exe","2"', 'valorant'), 'counter-strike-2');
  assert.equal(detectGame('', 'valorant'), null);
});

test('detects Minecraft Bedrock and Java edition', () => {
  assert.equal(detectGame('"Minecraft.Windows.exe","1"', null), 'minecraft');
  assert.equal(detectGame('"Minecraft.exe","1"', null), 'minecraft');
  assert.equal(isMinecraftJava('"javaw.exe","123","Console","1","500 MB","Running","User","0:05:00","Minecraft 1.21.4"'), true);
  assert.equal(isMinecraftJava('"javaw.exe","123","Console","1","500 MB","Running","User","0:05:00","Eclipse IDE"'), false);
  assert.equal(isMinecraftJava(''), false);
});
