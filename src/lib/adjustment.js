// A balance update is saved as a transfer with one side empty: money that came from, or went to, somewhere outside the ledger.
export const isAdjustment = t => t.type==='transfer'&&Boolean(t.from_account_id)!==Boolean(t.to_account_id)
export const adjustedAccount = t => t.from_account_name||t.to_account_name
export const adjustmentCents = t => (t.to_account_id?1:-1)*Number(t.amount_cents)
// A card's balance is negative while money is owed, so its form asks for the amount owed.
export const balanceFromEntry = (account, cents) => account.type==='credit'?-cents:cents
