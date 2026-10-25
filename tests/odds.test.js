'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { decimalFromAmerican, impliedProbability, normalizeOdds, bestPrices } = require('../lib/odds');

test('American odds convert correctly', () => {
  assert.equal(decimalFromAmerican(150), 2.5);
  assert.equal(decimalFromAmerican(-200), 1.5);
  assert.equal(decimalFromAmerican(0), null);
  assert.equal(decimalFromAmerican(-50), null);
});
test('implied probabilities are valid', () => {
  assert.equal(impliedProbability(2), 0.5);
  assert.equal(impliedProbability(1), null);
});
test('normalize odds and choose best price only for matching lines', () => {
  const fixture = [{
    id: 'game-1', home_team: 'Carolina Hurricanes', away_team: 'New York Rangers',
    bookmakers: [
      { key: 'a', markets: [{ key: 'player_shots_on_goal', outcomes: [
        { name: 'Over', description: 'Player A', point: 2.5, price: -110 },
        { name: 'Over', description: 'Player A', point: 3.5, price: 145 }
      ] }] },
      { key: 'b', markets: [{ key: 'player_shots_on_goal', outcomes: [
        { name: 'Over', description: 'Player A', point: 2.5, price: 110 }
      ] }] }
    ]
  }];
  const rows = normalizeOdds(fixture);
  assert.equal(rows.length, 3);
  const best = bestPrices(rows);
  assert.equal(best.length, 2);
  assert.equal(best.find(x => x.point === 2.5).bookmaker, 'b');
  assert.equal(best.find(x => x.point === 3.5).bookmaker, 'a');
});
