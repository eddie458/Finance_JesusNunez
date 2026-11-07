import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthSummary } from './monthSummary.js'
import { netWorthPoints } from './netWorth.js'
import { categoryColors, foldCategories, OTHER, SERIES } from './palette.js'
import { flowerBounds, petals } from './flower.js'
import { plainMoney } from './money.js'
import { dayHeading } from './dates.js'

const row = (type, amount_cents, occurred_on, category_name=null) => ({ type, amount_cents, occurred_on, category_name })

test('adds up the month and leaves transfers and other months out', () => {
  const rows=[row('expense',1000,'2026-11-02','Food'),row('expense','250','2026-11-03'),row('income',5000,'2026-11-01'),row('transfer',9000,'2026-11-01'),row('expense',700,'2026-10-20','Food')]
  const s=monthSummary(rows,'2026-11','2026-11-06')
  assert.equal(s.spent,1250); assert.equal(s.income,5000); assert.equal(s.count,2)
  assert.deepEqual(s.categories,[{name:'Food',cents:1000},{name:'Uncategorized',cents:250}])
})

test('compares a month in progress day for day', () => {
  const rows=[row('expense',100,'2026-11-05'),row('expense',900,'2026-11-20'),row('expense',300,'2026-10-05'),row('expense',5000,'2026-10-06'),row('expense',7000,'2026-10-07')]
  const {change}=monthSummary(rows,'2026-11','2026-11-06')
  assert.deepEqual(change,{cents:100-5300,month:'2026-10',sameDay:true})
})

test('stops at the last day of a shorter previous month', () => {
  const rows=[row('expense',100,'2026-03-31'),row('expense',400,'2026-02-28')]
  assert.equal(monthSummary(rows,'2026-03','2026-03-31').change.cents,-300)
})

test('compares a finished month whole, and skips the comparison with nothing before it', () => {
  const rows=[row('expense',100,'2026-10-05'),row('expense',400,'2026-09-30')]
  assert.deepEqual(monthSummary(rows,'2026-10','2026-11-06').change,{cents:-300,month:'2026-09',sameDay:false})
  assert.equal(monthSummary([row('expense',100,'2026-11-05')],'2026-11','2026-11-06').change,null)
})

test('runs net worth forward and keeps the last 12 months', () => {
  const points=netWorthPoints({opening_cents:1000,months:[{month:'2025-01',net_cents:'500'},{month:'2026-11',net_cents:'-200'}]},'2026-11')
  assert.equal(points.length,12); assert.equal(points[0].month,'2025-12'); assert.equal(points[0].cents,1500); assert.equal(points.at(-1).cents,1300)
  assert.deepEqual(netWorthPoints(undefined,'2026-11'),[{month:'2026-11',cents:0,value:0}])
})

test('keeps a category on its color whatever the month holds', () => {
  const colors=categoryColors([{category:'Rent',total_cents:'9000'},{category:'Food',total_cents:'5000'},{category:'Food',total_cents:'5000'},...['a','b','c','d','e'].map(category=>({category,total_cents:10}))])
  assert.equal(colors.colorOf('Food'),SERIES[0]); assert.equal(colors.colorOf('Rent'),SERIES[1]); assert.equal(colors.colorOf('Unknown'),OTHER)
  const folded=foldCategories([{name:'Rent',cents:100},{name:'e',cents:40},{name:'Pets',cents:30}],colors)
  assert.deepEqual(folded.map(c=>c.name),['Rent','Other'])
  assert.equal(folded.reduce((s,c)=>s+c.cents,0),170)
})

test('folds a category called Other into the shared Other', () => {
  const colors=categoryColors([{category:'Other',total_cents:900},{category:'Food',total_cents:100}])
  assert.deepEqual(colors.top,['Food']); assert.equal(colors.colorOf('Other'),OTHER)
  assert.deepEqual(foldCategories([{name:'Other',cents:90},{name:'Food',cents:10},{name:'Pets',cents:5}],colors).map(c=>[c.name,c.cents]),[['Other',95],['Food',10]])
})

test('scales petal area with the amount', () => {
  const [big,small]=petals([{name:'a',cents:400},{name:'b',cents:100}])
  assert.equal(big.length/small.length,2); assert.equal(big.share,80); assert.equal(big.rotate,-90); assert.equal(small.rotate,90)
})

test('keeps the smallest petals visible and the frame around every petal', () => {
  const flower=petals([{name:'a',cents:1000000},{name:'b',cents:1},{name:'c',cents:1}])
  assert.ok(flower[1].length>=22); assert.equal(flower[1].labelled,false)
  const [x,y,w,h]=flowerBounds(flower).split(' ').map(Number)
  assert.equal(w,h); assert.ok(y<=-flower[0].length); assert.ok(x<0&&x+w>0)
  assert.doesNotThrow(()=>flowerBounds(petals([{name:'only',cents:5}])))
})

test('shows the symbol without the currency code', () => {
  assert.equal(plainMoney(-1248075,'MXN'),'−$12,480.75'); assert.equal(plainMoney(5000,'EUR'),'€50.00'); assert.equal(plainMoney(5000,'GBP'),'50.00 GBP')
})

test('names recent days', () => {
  assert.equal(dayHeading('2026-11-06','2026-11-06'),'Today'); assert.equal(dayHeading('2026-11-05','2026-11-06'),'Yesterday'); assert.equal(dayHeading('2026-10-30','2026-11-06'),'Oct 30'); assert.equal(dayHeading('2025-12-30','2026-01-02'),'Dec 30, 2025')
})
