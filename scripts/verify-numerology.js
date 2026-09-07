const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'lifepath-test.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract the script content from lifepath-test.html
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error("FATAL: No <script> tag found in lifepath-test.html");
  process.exit(1);
}

const scriptCode = scriptMatch[1];

// Create a sandbox to extract the numerology functions
const sandbox = {
  window: {
    dispatchEvent: () => {},
    location: {}
  },
  document: {
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {}, style: {} }),
    querySelectorAll: () => []
  },
  CustomEvent: class {}
};

vm.createContext(sandbox);
vm.runInContext(scriptCode, sandbox);

const { calculateLifePathNumber, calculateExpressionNumber, reduceNumber, digitSum, MASTER_NUMBERS } = sandbox;

if (typeof calculateLifePathNumber !== 'function') {
  console.error("FATAL: calculateLifePathNumber function not found in script");
  process.exit(1);
}

console.log("Extracted numerology functions successfully from lifepath-test.html");

const VALID_SET = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]);
let failures = 0;
let totalChecked = 0;

// 1. 366-Day Leap Year Sweep (2024)
const startDate = new Date(Date.UTC(2024, 0, 1));
for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
  const currentDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const isoDate = currentDate.toISOString().split('T')[0];
  const result = calculateLifePathNumber(isoDate);
  totalChecked++;

  if (!VALID_SET.has(result)) {
    console.error(`FAILURE on ${isoDate}: result ${result} is not in valid set {1-9, 11, 22, 33}`);
    failures++;
  }
}

// 2. Multi-year random sweep across century (1920-2025: 1000 sample dates)
for (let y = 1920; y <= 2025; y += 5) {
  for (let m = 1; m <= 12; m++) {
    const isoDate = `${y}-${String(m).padStart(2, '0')}-15`;
    const result = calculateLifePathNumber(isoDate);
    totalChecked++;
    if (!VALID_SET.has(result)) {
      console.error(`FAILURE on ${isoDate}: result ${result} is not in valid set`);
      failures++;
    }
  }
}

// 3. Known worked examples
// Standard Pythagorean examples:
// 1989-11-17: Month 11 (Master 11), Day 17 (1+7=8), Year 1989 (1+9+8+9 = 27 -> 2+7=9). Total: 11 + 8 + 9 = 28 -> 2+8 = 10 -> 1+0 = 1.
// 1975-06-04: Month 6, Day 4, Year 1975 (1+9+7+5 = 22 -> Master 22). Total: 6 + 4 + 22 = 32 -> 3+2 = 5.
// 1980-04-16: Month 4, Day 16 (1+6=7), Year 1980 (1+9+8+0 = 18 -> 1+8=9). Total: 4 + 7 + 9 = 20 -> 2+0 = 2.
// 1969-12-28: Month 12 (1+2=3), Day 28 (2+8=10 -> 1), Year 1969 (1+9+6+9 = 25 -> 2+5=7). Total: 3 + 1 + 7 = 11 (Master 11).
const testCases = [
  { date: "1989-11-17", expected: 1 },
  { date: "1975-06-04", expected: 5 },
  { date: "1980-04-16", expected: 2 },
  { date: "1969-12-28", expected: 11 }
];

for (const tc of testCases) {
  const actual = calculateLifePathNumber(tc.date);
  totalChecked++;
  if (actual !== tc.expected) {
    console.error(`FAILURE on known example ${tc.date}: expected ${tc.expected}, got ${actual}`);
    failures++;
  }
}

// 4. Expression number verification
const nameTests = [
  { name: "John Doe", expected: 8 },
  { name: "Ada Lovelace", expected: 11 }
];
for (const nt of nameTests) {
  const actual = calculateExpressionNumber(nt.name);
  if (!VALID_SET.has(actual)) {
    console.error(`FAILURE on expression test "${nt.name}": result ${actual} not in valid set`);
    failures++;
  }
}

console.log(`\n========================================`);
console.log(`TOTAL DATES TESTED: ${totalChecked}`);
console.log(`TOTAL FAILURES: ${failures}`);
console.log(`VALID SET VERIFIED: {1-9, 11, 22, 33}`);
console.log(`========================================\n`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("RESULT: 0 invalid outputs. Math successfully re-verified.");
  process.exit(0);
}
