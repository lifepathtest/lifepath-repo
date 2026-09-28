// Shared, dependency-free helpers for the node:test suites in this folder.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const PAGE_COPIES = ['public/index.html', 'index.html', 'lifepath-test.html', 'public/lifepath-test.html'];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

async function loadWorker() {
  const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'index.js')).href);
  return mod.default;
}

// Runs the page's main inline <script> in a sandbox (same approach as verify-numerology.js)
// and returns the sandbox so pure functions can be called directly.
function loadPageScript(rel = 'public/index.html') {
  const match = read(rel).match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No plain <script> block found in ' + rel);
  const sandbox = {
    window: { dispatchEvent: () => {}, location: {} },
    document: {
      addEventListener: () => {},
      getElementById: () => ({ addEventListener: () => {}, style: {} }),
      querySelectorAll: () => []
    },
    CustomEvent: class {}
  };
  vm.createContext(sandbox);
  vm.runInContext(match[1], sandbox);
  return sandbox;
}

module.exports = { ROOT, PAGE_COPIES, read, loadWorker, loadPageScript };
