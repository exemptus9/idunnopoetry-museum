// Exercise the historical reader -> Atlas trail with approved public fixtures only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';

const site = new URL('../museum-static/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('classic/data/poems.json', site), 'utf8'));
const readerScript = fs.readFileSync(new URL('classic/assets/js/site.js', site), 'utf8');
const origin = 'https://exemptus9.github.io/idunnopoetry-museum/';
const trailKey = 'idp_atlas_read_v1';
let upperCaseTrail;
for (const poem of manifest) {
  const html = fs.readFileSync(new URL('classic/poems/' + poem.slug + '.html', site), 'utf8');
  const dom = new JSDOM(html, {url: origin + 'classic/poems/' + poem.slug + '.html', runScripts: 'outside-only'});
  dom.window.eval(readerScript);
  const trail = JSON.parse(dom.window.localStorage.getItem(trailKey) || '[]');
  assert.equal(trail[0]?.slug, poem.slug, 'Every exact historical slug enters the trail: ' + poem.slug);
  assert.equal(trail[0].title, dom.window.document.querySelector('article.poem').getAttribute('aria-label'));
  if (poem.slug === 'HM') upperCaseTrail = trail;
  dom.window.close();
}
assert.ok(upperCaseTrail, 'Uppercase historical slug regression fixture exists');

const atlas = new JSDOM(fs.readFileSync(new URL('atlas/index.html', site), 'utf8'),
  {url: origin + 'atlas/', runScripts: 'outside-only'});
const w = atlas.window;
w.localStorage.setItem(trailKey, JSON.stringify(upperCaseTrail));
w.HTMLElement.prototype.scrollIntoView = () => {};
w.eval(fs.readFileSync(new URL('atlas/poems.js', site), 'utf8'));
w.eval(fs.readFileSync(new URL('atlas/atlas.js', site), 'utf8'));
const recent = w.document.querySelector('#recent-list a');
assert.ok(recent, 'Returning to Atlas exposes the historical reading trail');
assert.equal(new URL(recent.href).pathname, '/idunnopoetry-museum/classic/poems/HM.html');
assert.match(recent.textContent, /H\.M\./);
assert.equal(w.document.querySelector('#clear-trail').hidden, false);
w.document.querySelector('#clear-trail').click();
assert.equal(w.localStorage.getItem(trailKey), null, 'Clear trail removes only local reading history');
assert.equal(w.document.querySelector('#recent-list a'), null);
assert.equal(w.document.querySelector('#clear-trail').hidden, true);
atlas.window.close();
console.log(`PASS: ${manifest.length} exact historical slugs; uppercase reader -> Atlas -> clear trail journey.`);
