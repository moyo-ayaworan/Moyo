import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const chat = fs.readFileSync('components/EniyanChat.tsx', 'utf8');
const css = fs.readFileSync('app/globals.css', 'utf8');
const chrome = fs.readFileSync('components/AppChrome.tsx', 'utf8');

// These guards complement browser QA: legacy theme rules intentionally remap
// text-white and bg-white, so fixed dark surfaces must not use those utilities.
test('chat dark surfaces retain explicit light foregrounds in light mode', () => {
  assert.match(chat, /bg-\[#111111\] text-\[#ffffff\]/);
  assert.match(chat, /bg-\[#181818\] text-\[#ffffff\]/);
  assert.match(chat, /bg-black text-\[#ffffff\] hover:bg-accent/);
  assert.doesNotMatch(chat, /bg-(?:\[#111111\]|\[#181818\]|black) text-white\b/);
  assert.match(chat, /hover:bg-\[#ffffff\] hover:text-black/);
});

test('studio pointer is browser-rendered, with native fallbacks and no hidden cursor', () => {
  assert.doesNotMatch(chrome, /CustomCursor/);
  assert.doesNotMatch(css, /cursor:\s*none|custom-cursor/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /--studio-cursor: url\('\/cursor-lucide-outline.svg'\) 4 4/);
  assert.match(css, /\[data-theme='light'\] body\s*\{\s*--studio-cursor: url\('\/cursor-lucide-outline-light.svg'\) 4 4/);
  assert.match(css, /cursor: var\(--studio-cursor\), auto/);
  assert.match(css, /cursor: url\('\/cursor-lucide-click.svg'\) 9 9, pointer/);
  assert.match(css, /cursor: url\('\/cursor-lucide-zoom.svg'\) 11 11, zoom-in/);
  assert.match(css, /cursor: url\('\/cursor-lucide-grab.svg'\) 8 3, grab/);
  assert.match(css, /cursor: url\('\/cursor-lucide-blocked.svg'\) 3 3, not-allowed/);
  assert.match(css, /cursor: url\('\/cursor-lucide-loading.svg'\) 4 4, wait/);
  assert.match(css, /cursor: text/);
  assert.match(css, /not-allowed/);
  const lucideSource = fs.readFileSync('node_modules/lucide-react/dist/esm/icons/mouse-pointer-2.js', 'utf8');
  const lucidePath = lucideSource.match(/d: "([^"]+)"/)[1];
  for (const asset of ['cursor-lucide-outline.svg', 'cursor-lucide-outline-light.svg', 'cursor-lucide-outline-active.svg']) {
    const svg = fs.readFileSync(`public/${asset}`, 'utf8');
    assert.match(svg, /width="24" height="24"/);
    assert.match(svg, /fill="none"/);
    assert.match(svg, /stroke-width="2"/);
    assert.doesNotMatch(svg, /fill="#/);
    assert.ok(svg.includes(`d="${lucidePath}"`), 'Uses the real Lucide MousePointer2 geometry');
    assert.match(svg, /cursor-LICENSE.txt/);
    assert.doesNotMatch(svg, /<script|<filter|<animate|href=/);
  }
  for (const asset of ['cursor-lucide-click.svg', 'cursor-lucide-zoom.svg', 'cursor-lucide-grab.svg', 'cursor-lucide-blocked.svg', 'cursor-lucide-loading.svg']) {
    const svg = fs.readFileSync(`public/${asset}`, 'utf8');
    assert.match(svg, /width="24" height="24"/);
    assert.match(svg, /fill="none"/);
    assert.match(svg, /stroke-width="2"/);
    assert.match(svg, /cursor-LICENSE.txt/);
    assert.doesNotMatch(svg, /<script|<filter|<animate|href=/);
  }
});

test('red click spark remains separate from pointer movement and idle animation', () => {
  const spark = fs.readFileSync('components/ClickSpark.tsx', 'utf8');
  assert.match(chrome, /<ClickSpark\s+sparkColor="#920110"/);
  assert.match(spark, /sparksRef.current.length > 0/);
  assert.match(spark, /addEventListener\('pointerdown'/);
  assert.match(spark, /target\?\.closest/);
  assert.doesNotMatch(spark, /addEventListener\('pointermove'/);
});
