import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustedAccount, adjustmentCents, balanceFromEntry, isAdjustment } from './adjustment.js'

const raised = { type:'transfer', amount_cents:'5000', from_account_id:null, to_account_id:3, to_account_name:'Savings' }
const lowered = { type:'transfer', amount_cents:'1250', from_account_id:3, to_account_id:null, from_account_name:'Savings' }

test('treats a transfer with one side empty as a balance adjustment', () => {
  assert.equal(isAdjustment(raised), true)
  assert.equal(isAdjustment(lowered), true)
})

test('leaves ordinary transfers and other transactions alone', () => {
  assert.equal(isAdjustment({ type:'transfer', from_account_id:1, to_account_id:2 }), false)
  assert.equal(isAdjustment({ type:'transfer', from_account_id:null, to_account_id:null }), false)
  assert.equal(isAdjustment({ type:'income', from_account_id:null, to_account_id:2 }), false)
  assert.equal(isAdjustment({ type:'expense', from_account_id:1, to_account_id:null }), false)
})

test('signs an adjustment by the way the money moved', () => {
  assert.equal(adjustmentCents(raised), 5000)
  assert.equal(adjustmentCents(lowered), -1250)
  assert.equal(adjustedAccount(raised), 'Savings')
  assert.equal(adjustedAccount(lowered), 'Savings')
})

test('turns the amount owed on a card into a negative balance', () => {
  assert.equal(balanceFromEntry({ type:'credit' }, 320000), -320000)
  assert.equal(balanceFromEntry({ type:'debit' }, 320000), 320000)
  assert.equal(balanceFromEntry({ type:'debit' }, -500), -500)
})
