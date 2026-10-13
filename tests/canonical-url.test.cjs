'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const canonical = source.slice(source.indexOf('  const canonicalPath='), source.indexOf('  const STORE_KEY'));

test('duplicate path slashes redirect to a canonical Pages URL preserving query and view', () => {
  let destination;
  const location = {
    origin: 'https://example.test', pathname: '//worldforge///', search: '?update=1', hash: '#guilda',
    replace: url => { destination = url; }
  };
  vm.runInNewContext(`(function(){${canonical}})()`, { location });
  assert.equal(destination, 'https://example.test/worldforge/?update=1#guilda');
});

test('canonical Pages root does not redirect or start a navigation loop', () => {
  let redirected = false;
  const location = { origin: 'https://example.test', pathname: '/', search: '', hash: '', replace: () => { redirected = true; } };
  vm.runInNewContext(`(function(){${canonical}})()`, { location });
  assert.equal(redirected, false);
});
