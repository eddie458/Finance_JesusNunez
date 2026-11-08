import test from 'node:test'
import assert from 'node:assert/strict'
import { monthLabel, monthWindow } from './dates.js'

test('keeps a chart on the latest months while the chosen month is among them', () => {
  assert.deepEqual(monthWindow('2026-11','2026-11',3),['2026-09','2026-10','2026-11'])
  assert.deepEqual(monthWindow('2026-09','2026-11',3),['2026-09','2026-10','2026-11'])
  assert.equal(monthWindow('2025-12','2026-11',12)[0],'2025-12')
})

test('moves the window back to end on an older chosen month, across years', () => {
  assert.deepEqual(monthWindow('2026-08','2026-11',3),['2026-06','2026-07','2026-08'])
  assert.deepEqual(monthWindow('2026-01','2026-11',3),['2025-11','2025-12','2026-01'])
  assert.deepEqual(monthWindow('2025-11','2026-11',12).slice(-2),['2025-10','2025-11'])
})

test('ends the window on a chosen month that is still ahead', () => {
  assert.deepEqual(monthWindow('2027-01','2026-11',2),['2026-12','2027-01'])
})

test('names a month without its year only in the current year', () => {
  assert.equal(monthLabel('2026-10','2026-11'),'October')
  assert.equal(monthLabel('2025-10','2026-11'),'October 2025')
})
