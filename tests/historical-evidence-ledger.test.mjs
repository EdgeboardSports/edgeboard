import assert from 'node:assert/strict';
import {createHistoricalEvidenceLedger} from '../scripts/historical-evidence-ledger.mjs';
assert.equal(createHistoricalEvidenceLedger().mode,'synthetic');
console.log('Ledger smoke test passed');
