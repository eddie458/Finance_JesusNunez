<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/TransactionImport.php';

function ok(bool $passed, string $name, mixed $detail = null): void { if (!$passed) throw new RuntimeException("$name failed: " . json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)); echo "✓ $name\n"; }

// The database compares names without regard to case, so the stand-in lookups do too.
$accounts = [['id'=>1,'name'=>'Débito BBVA'],['id'=>2,'name'=>'Ahorros'],['id'=>3,'name'=>'Cash'],['id'=>4,'name'=>'Wallet'],['id'=>5,'name'=>'WALLET']];
$categories = [['id'=>10,'name'=>'Food'],['id'=>11,'name'=>'Gifts']];
$named = fn(array $rows) => fn(string $name) => array_values(array_filter($rows, fn($row) => mb_strtolower($row['name']) === mb_strtolower($name)));
$row = fn(int $id, string $type, int $cents, string $date, array $more = []) => [
    'id'=>$id,'type'=>$type,'amount_cents'=>$cents,'occurred_on'=>$date,'is_historical'=>0,'from_account_id'=>null,'to_account_id'=>null,'category_id'=>null,
    'merchant'=>null,'note'=>null,'exclude_from_insights'=>0,'from_account_name'=>null,'to_account_name'=>null,'category_name'=>null, ...$more];
$ledger = [
    100 => $row(100, 'expense', 4500, '2026-11-05', ['from_account_id'=>1,'from_account_name'=>'Débito BBVA','merchant'=>'Oxxo']),
    101 => $row(101, 'income', 2500000, '2026-11-01', ['to_account_id'=>1,'to_account_name'=>'Débito BBVA','merchant'=>'Salary']),
    102 => $row(102, 'transfer', 100000, '2026-11-02', ['from_account_id'=>1,'from_account_name'=>'Débito BBVA','to_account_id'=>2,'to_account_name'=>'Ahorros','merchant'=>'To savings']),
    103 => $row(103, 'transfer', 5000, '2026-11-03', ['to_account_id'=>3,'to_account_name'=>'Cash','merchant'=>'Balance adjustment']),
    104 => $row(104, 'expense', 1550, '2026-10-10', ['is_historical'=>1,'category_id'=>10,'category_name'=>'Food','merchant'=>'  Tacos  ','note'=>'','exclude_from_insights'=>1]),
    105 => $row(105, 'income', 2000, '2026-10-12', ['to_account_id'=>1,'to_account_name'=>'Débito BBVA','category_id'=>11,'category_name'=>'Gifts','merchant'=>'Refund']),
];
// What an export writes for a ledger row. Every file goes through JSON the way an upload arrives, so 45.5 comes back as a float.
$entry = fn(array $t) => ['id'=>$t['id'],'date'=>$t['occurred_on'],'type'=>$t['type'],'amount'=>$t['amount_cents']/100,'description'=>$t['merchant'],'category'=>$t['category_name'],'from_account'=>$t['from_account_name'],'to_account'=>$t['to_account_name'],'note'=>$t['note'],'changes_balances'=>!$t['is_historical'],'hidden_from_insights'=>(bool)$t['exclude_from_insights']];
$plan = fn(array $entries, ?array $from = null) => TransactionImport::plan(json_decode(json_encode($entries), true), $from ?? $ledger, $named($accounts), $named($categories));
$messages = fn(array $p) => array_column($p['errors'], 'message', 'entry');
$changes = fn(array $update) => array_map(fn($c) => "{$c['field']}: ".json_encode($c['from'], JSON_UNESCAPED_UNICODE).' → '.json_encode($c['to'], JSON_UNESCAPED_UNICODE), $update['changes']);
$spending = ['date'=>'2026-11-06','type'=>'expense','amount'=>85,'description'=>'Starbucks','from_account'=>'Débito BBVA'];
$problem = fn(array $entry) => $plan([$entry])['errors'][0]['message'] ?? null;

$p = $plan(array_map($entry, array_values($ledger)));
ok($p['unchanged'] === 6 && !$p['updates'] && !$p['additions'] && !$p['errors'], 'an exported file imports with nothing to change', $p);

$edited = array_map($entry, array_values($ledger)); $edited[0]['amount'] = 50; $edited[0]['category'] = 'Food';
$p = $plan($edited);
ok($p['unchanged'] === 5 && count($p['updates']) === 1 && $p['updates'][0]['id'] === 100 && $changes($p['updates'][0]) === ['amount: 4500 → 5000', 'category: null → "Food"'], 'only the fields that differ are changed', $p['updates']);
ok($p['updates'][0]['transaction']['category_id'] === 10 && $p['updates'][0]['transaction']['merchant'] === 'Oxxo' && !$p['new_categories'], 'an existing category is used, not created again', $p);

$p = $plan([['id'=>100,'note'=>'Weekly shop']]);
ok($changes($p['updates'][0]) === ['note: null → "Weekly shop"'] && $p['updates'][0]['transaction']['amount_cents'] === 4500, 'an entry can list just the fields it changes', $p['updates']);

$p = $plan([['id'=>100,'amount'=>'45.00'],['id'=>101,'amount'=>25000.0],['id'=>104,'amount'=>15.5,'description'=>'Tacos','note'=>'   '],['id'=>102,'from_account'=>'débito bbva']]);
ok($p['unchanged'] === 4 && !$p['errors'], 'spelling a value differently is not a change', $p);

$p = $plan([['id'=>100,'description'=>''],['id'=>104,'changes_balances'=>true,'from_account'=>'Cash','hidden_from_insights'=>false],['id'=>100,'date'=>'2026-11-04','type'=>'income','from_account'=>null,'to_account'=>'Cash']]);
ok($messages($p) === [3=>'Entry 1 already has id 100. A transaction can appear only once.'] && $changes($p['updates'][0]) === ['description: "Oxxo" → null'] && $changes($p['updates'][1]) === ['from_account: null → "Cash"', 'changes_balances: false → true', 'hidden_from_insights: true → false'], 'empty text clears a field, and switches change what they say', $p);

$p = $plan([['id'=>100,'date'=>'2026-11-04','type'=>'income','from_account'=>null,'to_account'=>'Cash','category'=>null]]);
ok($changes($p['updates'][0]) === ['date: "2026-11-05" → "2026-11-04"', 'type: "expense" → "income"', 'from_account: "Débito BBVA" → null', 'to_account: null → "Cash"'], 'a transaction can change type when its accounts move with it', $p);

$p = $plan([$spending, [...$spending,'description'=>'Groceries run','category'=>'Groceries'], [...$spending,'amount'=>'12.30','category'=>'groceries'], [...$spending,'amount'=>1,'category'=>'Uncategorized']]);
$added = array_column($p['additions'], 'transaction');
ok(count($added) === 4 && $added[0]['amount_cents'] === 8500 && $added[0]['from_account_id'] === 1 && $added[0]['is_historical'] === 0 && $added[0]['exclude_from_insights'] === 0 && $added[2]['amount_cents'] === 1230, 'entries without an id are added', $p);
ok($p['new_categories'] === ['Groceries'] && $added[2]['new_category'] === 'groceries' && $added[3]['category_id'] === null && $added[3]['new_category'] === null, 'a new category is listed once, and Uncategorized means none', $p['new_categories']);

$p = $plan([['date'=>'2026-11-07','type'=>'income','amount'=>10,'changes_balances'=>false,'description'=>'Cash gift']]);
ok($p['additions'][0]['transaction']['is_historical'] === 1 && !$p['errors'], 'a new transaction can leave balances alone', $p);

$p = $plan([[...$spending,'description'=>'OXXO','date'=>'2026-11-05','amount'=>45], $spending]);
ok($p['additions'][0]['matches'] === 100 && $p['additions'][1]['matches'] === null, 'a transaction already in the ledger is flagged when added again', $p['additions']);

$p = $plan([['type'=>'expense','amount'=>5,'from_account'=>'Cash'], [], ['description'=>'Only words']]);
ok($messages($p) === [1=>'A new transaction needs "date".', 2=>'A new transaction needs "date", "type" and "amount".', 3=>'A new transaction needs "date", "type" and "amount".'], 'a new transaction needs a date, type and amount', $p['errors']);

$p = $plan([['id'=>999,'amount'=>1], ['id'=>100,'amount'=>1], ['id'=>100,'amount'=>2], ['id'=>'abc'], ['id'=>0], ['id'=>'101','amount'=>1], ['id'=>-4]]);
$noId = '"id" is the number a transaction has in an export. Leave it out to add a new transaction.';
ok($messages($p) === [1=>'There’s no transaction with id 999 in your ledger. Remove the id to add this as a new transaction.', 3=>'Entry 2 already has id 100. A transaction can appear only once.', 4=>$noId, 5=>$noId, 7=>$noId] && array_column($p['updates'], 'id') === [100, 101], 'ids come from this ledger, once each', $p);

$p = $plan([['id'=>100,'from_account'=>'Nowhere'], ['id'=>102,'to_account'=>'wallet']]);
ok($messages($p) === [1=>'There’s no account named "Nowhere". Check the spelling, or add the account on the Accounts page first.', 2=>'More than one account is named "wallet". Rename one in Fluent first.'], 'an account name has to match exactly one account', $p['errors']);

ok($problem(['id'=>103,'amount'=>60]) === 'This is a balance adjustment, which can’t be edited. Delete it in Fluent to undo it, or use Update balance on the Accounts page.', 'a balance adjustment can’t be edited', $plan([['id'=>103,'amount'=>60]]));
ok($plan([['id'=>103,'type'=>'transfer','to_account'=>'cash','from_account'=>null]])['unchanged'] === 1, 'a balance adjustment can stay in the file unchanged', null);

foreach ([
    [['id'=>100,'to_account'=>'Ahorros'], 'An expense only leaves an account. Set "to_account" to null.'],
    [['id'=>100,'from_account'=>null], 'An expense needs a "from_account", or set "changes_balances" to false.'],
    [['id'=>101,'from_account'=>'Cash'], 'Income only enters an account. Set "from_account" to null.'],
    [['id'=>101,'type'=>'expense'], 'An expense needs a "from_account", or set "changes_balances" to false.'],
    [['id'=>101,'to_account'=>null], 'Income needs a "to_account", or set "changes_balances" to false.'],
    [['id'=>102,'to_account'=>'Débito BBVA'], 'A transfer needs two different accounts.'],
    [['id'=>102,'to_account'=>null], 'A transfer needs a "from_account" and a "to_account".'],
    [['id'=>102,'hidden_from_insights'=>true], 'Transfers never count in insights, so "hidden_from_insights" has to be false.'],
    [['id'=>102,'changes_balances'=>false,'from_account'=>null,'to_account'=>null], 'A transfer always changes balances, so "changes_balances" has to be true.'],
    [['id'=>101,'category'=>'Food'], 'Only expenses have a category. Set "category" to null.'],
    [['id'=>105,'amount'=>1], 'Only expenses have a category. Set "category" to null.'],
    [['id'=>100,'changes_balances'=>false], 'A transaction that doesn’t change balances has no accounts. Set "from_account" and "to_account" to null, or set "changes_balances" to true.'],
] as [$change, $message]) ok($problem($change) === $message, 'rule: '.$message, $plan([$change]));
ok($plan([['id'=>105,'amount'=>1,'category'=>null]])['updates'][0]['transaction']['category_id'] === null, 'clearing a stale category lets the income change', null);
ok($changes($plan([['id'=>100,'changes_balances'=>false,'from_account'=>null]])['updates'][0]) === ['from_account: "Débito BBVA" → null', 'changes_balances: true → false'], 'a transaction can stop changing balances once its account is gone', null);

$cents = function (mixed $amount) use ($plan, $spending) { $p = $plan([[...$spending, 'amount'=>$amount]]); return $p['additions'][0]['transaction']['amount_cents'] ?? $p['errors'][0]['message']; };
$notAmount = '"amount" is a positive number with up to two decimals, like 45.50. The type says which way the money moves.';
foreach ([[45, 4500], [45.5, 4550], [0.07, 7], ['0.5', 50], [' 12.30 ', 1230], [9999999999999.99, 999999999999999], ['0012', 1200],
          [0.1 + 0.2, $notAmount], [12.345, $notAmount], [-5, $notAmount], ['-5', $notAmount], ['1,234.00', $notAmount], ['$5', $notAmount], ['', $notAmount], [true, $notAmount], ['1e3', $notAmount],
          [0, '"amount" has to be more than zero.'], ['0.00', '"amount" has to be more than zero.'], [10000000000000, '"amount" is too large.'], ['99999999999999999999', '"amount" is too large.']] as [$amount, $expected])
    ok($cents($amount) === $expected, 'amount '.var_export($amount, true).' reads as '.var_export($expected, true), $cents($amount));

$notDate = '"date" is a real day, written like 2026-11-05.';
foreach (['2026-02-30', '2026-2-3', '1899-12-31', '2101-01-01', 20261105, '2026-11-05T10:00'] as $date) ok($problem([...$spending, 'date'=>$date]) === $notDate, 'date '.var_export($date, true).' is refused', $plan([[...$spending, 'date'=>$date]]));
ok($plan([[...$spending, 'date'=>'2028-02-29']])['additions'][0]['transaction']['occurred_on'] === '2028-02-29', 'a leap day is a real day', null);

foreach ([
    [['id'=>100,'categroy'=>'Food'], '"categroy" isn’t a field Fluent knows. Check its spelling.'],
    [['id'=>100,'type'=>'Expense'], '"type" is "expense", "income" or "transfer".'],
    [['id'=>100,'hidden_from_insights'=>'yes'], '"hidden_from_insights" is true or false.'],
    [['id'=>100,'description'=>42], '"description" is text, or null to leave it empty.'],
    [['id'=>100,'description'=>str_repeat('é', 121)], '"description" can be at most 120 characters.'],
    [['id'=>100,'category'=>str_repeat('x', 61)], '"category" can be at most 60 characters.'],
    [['id'=>100,'note'=>str_repeat('x', 65536)], '"note" is too long.'],
] as [$change, $message]) ok($problem($change) === $message, 'field check: '.$message, $plan([$change]));
ok($plan([['id'=>100,'description'=>str_repeat('é', 120)]])['updates'][0]['transaction']['merchant'] === str_repeat('é', 120), 'a 120-character description fits, counted in characters', null);

$p = $plan(['hello', [1, 2], null]);
ok(count(array_unique($messages($p))) === 1 && count($p['errors']) === 3 && str_starts_with($p['errors'][0]['message'], 'This isn’t a transaction.'), 'an entry that isn’t an object is refused', $p);

$p = $plan(array_fill(0, 150, ['id'=>'x']));
ok($p['error_count'] === 150 && count($p['errors']) === 100 && $p['errors'][99]['entry'] === 100, 'a long list of problems is cut at a hundred, with the full count', [$p['error_count'], count($p['errors'])]);

$file = [['id'=>100,'amount'=>50], $spending];
$changed = $ledger; $changed[100]['amount_cents'] = 4800;
ok($plan($file)['fingerprint'] === $plan($file)['fingerprint'] && $plan($file)['fingerprint'] !== $plan($file, $changed)['fingerprint'], 'the fingerprint changes when the ledger does', null);
$changed = $ledger; $changed[100]['merchant'] = 'Oxxo Centro';
ok($plan([['id'=>101,'amount'=>1]])['fingerprint'] === $plan([['id'=>101,'amount'=>1]], $changed)['fingerprint'], 'the fingerprint ignores transactions the file doesn’t touch', null);
