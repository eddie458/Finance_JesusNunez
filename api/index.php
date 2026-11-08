<?php
declare(strict_types=1);
require __DIR__ . '/src/Database.php'; require __DIR__ . '/src/Http.php'; require __DIR__ . '/src/Auth.php'; require __DIR__ . '/src/AdminBootstrap.php'; require __DIR__ . '/src/BillingCycle.php'; require __DIR__ . '/src/TransactionImport.php'; require __DIR__ . '/src/SessionStore.php';

header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
$pdo = Database::connection(); AdminBootstrap::ensure($pdo); $method = $_SERVER['REQUEST_METHOD'];
$path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/') ?: '/';

function rows(PDOStatement $statement): array { $statement->execute(); return $statement->fetchAll(); }
function one(PDOStatement $statement): ?array { $statement->execute(); return $statement->fetch() ?: null; }
function accountForUser(PDO $pdo, int $id, int $userId): array {
    $s = $pdo->prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?'); $s->execute([$id, $userId]);
    return $s->fetch() ?: Http::fail('Account not found.', 404);
}
function validateTransaction(PDO $pdo, array $data, int $userId): array {
    $type = $data['type'] ?? ''; $amount = filter_var($data['amount_cents'] ?? null, FILTER_VALIDATE_INT);
    $date = $data['occurred_on'] ?? ''; $from = $data['from_account_id'] ?? null; $to = $data['to_account_id'] ?? null; $historical = filter_var($data['is_historical'] ?? false, FILTER_VALIDATE_BOOLEAN); $excluded = filter_var($data['exclude_from_insights'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (!in_array($type, ['expense','income','transfer'], true) || $amount === false || $amount <= 0 || !DateTimeImmutable::createFromFormat('!Y-m-d', $date)) Http::fail('Type, positive amount, and valid date are required.');
    $from = $from === null || $from === '' ? null : (int)$from; $to = $to === null || $to === '' ? null : (int)$to;
    if ($historical) {
        if ($from || $to) Http::fail('Transactions that don’t change balances cannot be connected to an account.');
    } elseif (($type === 'expense' && (!$from || $to)) || ($type === 'income' && ($from || !$to)) || ($type === 'transfer' && (!$from || !$to || $from === $to))) Http::fail('The selected accounts do not match this transaction type.');
    foreach (array_filter([$from, $to]) as $accountId) accountForUser($pdo, $accountId, $userId);
    $category = empty($data['category_id']) ? null : (int)$data['category_id'];
    if ($category) { $s=$pdo->prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?'); $s->execute([$category,$userId]); if (!$s->fetch()) Http::fail('Category not found.', 404); }
    return ['type'=>$type,'amount_cents'=>$amount,'occurred_on'=>$date,'is_historical'=>(int)$historical,'from_account_id'=>$from,'to_account_id'=>$to,'category_id'=>$category,'merchant'=>trim($data['merchant'] ?? '') ?: null,'note'=>trim($data['note'] ?? '') ?: null,'exclude_from_insights'=>(int)($excluded && $type !== 'transfer')];
}
function accountList(PDO $pdo, int $userId): array {
    $sql = "SELECT a.*, a.opening_balance_cents + COALESCE(SUM(CASE WHEN t.to_account_id=a.id THEN t.amount_cents ELSE 0 END),0) - COALESCE(SUM(CASE WHEN t.from_account_id=a.id THEN t.amount_cents ELSE 0 END),0) AS balance_cents, c.credit_limit_cents, c.statement_day, c.due_day FROM accounts a LEFT JOIN transactions t ON (t.from_account_id=a.id OR t.to_account_id=a.id) AND t.user_id=a.user_id LEFT JOIN credit_card_details c ON c.account_id=a.id WHERE a.user_id=? GROUP BY a.id ORDER BY a.is_archived, a.name";
    $s=$pdo->prepare($sql); $s->execute([$userId]); return $s->fetchAll();
}
function insightGroup(string $group): string {
    $fields = ['day'=>"DATE_FORMAT(t.occurred_on, '%Y-%m-%d')",'month'=>"DATE_FORMAT(t.occurred_on, '%Y-%m')",'category'=>"COALESCE(c.name, 'Uncategorized')",'merchant'=>"COALESCE(t.merchant, 'Unspecified')"];
    return $fields[$group] ?? Http::fail('Invalid grouping.');
}
// The first date of a month or day label and the date after it ends. Comparing DATE_FORMAT output with a bound value returns a 500 on Hostinger.
function insightDates(string $group, string $label): array {
    $format=$group==='month'?'Y-m':'Y-m-d'; $first=DateTimeImmutable::createFromFormat("!$format",$label);
    if(!$first||$first->format($format)!==$label)Http::fail('Choose a valid month or day to review.');
    return [$first->format('Y-m-d'),$first->modify($group==='month'?'+1 month':'+1 day')->format('Y-m-d')];
}
function dateFilters(string $column): array {
    $where = []; $params = [];
    foreach (['from'=>'>=','to'=>'<='] as $key=>$op) if (!empty($_GET[$key])) { $where[] = "$column $op ?"; $params[] = $_GET[$key]; }
    return [$where, $params];
}

// Authentication
if ($path === '/api/auth/login' && $method === 'POST') { $b=Http::body(); $s=$pdo->prepare('SELECT * FROM users WHERE email=?'); $s->execute([strtolower(trim($b['email']??''))]); $u=$s->fetch(); if (!$u || !password_verify($b['password']??'', $u['password_hash'])) Http::fail('Invalid email or password.',401); Auth::login((int)$u['id']); Http::respond(['id'=>(int)$u['id'],'email'=>$u['email'],'base_currency'=>$u['base_currency'],'role'=>$u['role']]); }
if ($path === '/api/auth/logout' && $method === 'POST') { Auth::logout(); Http::respond(['ok'=>true]); }
if ($path === '/api/auth/me' && $method === 'GET') Http::respond(Auth::currentUser($pdo));
if ($path === '/api/auth/me' && $method === 'PATCH') { $user=Auth::currentUser($pdo);$b=Http::body();if(!array_key_exists('skip_balances_by_default',$b))Http::fail('Nothing to update.');$skip=(int)filter_var($b['skip_balances_by_default'],FILTER_VALIDATE_BOOLEAN);$pdo->prepare('UPDATE users SET skip_balances_by_default=? WHERE id=?')->execute([$skip,$user['id']]);Http::respond([...$user,'skip_balances_by_default'=>$skip]); }

$userId = Auth::userId();
// Administration: account creation is intentionally unavailable to non-admin users.
if ($path === '/api/admin/users' && $method === 'GET') {
    Auth::requireAdmin($pdo);
    $users = $pdo->query('SELECT id, email, base_currency, role, created_at FROM users ORDER BY created_at DESC')->fetchAll();
    Http::respond($users);
}
if ($path === '/api/admin/users' && $method === 'POST') {
    Auth::requireAdmin($pdo); $body = Http::body();
    $email = filter_var($body['email'] ?? '', FILTER_VALIDATE_EMAIL); $password = $body['password'] ?? ''; $currency = strtoupper($body['base_currency'] ?? 'MXN');
    if (!$email || strlen($password) < 8 || !preg_match('/^[A-Z]{3}$/', $currency)) Http::fail('Provide an email, an 8-character password, and a three-letter currency.');
    try { $s = $pdo->prepare("INSERT INTO users (email, password_hash, base_currency, role) VALUES (?, ?, ?, 'user')"); $s->execute([$email, password_hash($password, PASSWORD_DEFAULT), $currency]); }
    catch (PDOException) { Http::fail('That email is already registered.', 409); }
    Http::respond(['id'=>(int)$pdo->lastInsertId(), 'email'=>$email, 'base_currency'=>$currency, 'role'=>'user'], 201);
}
// Accounts
if ($path === '/api/accounts' && $method === 'GET') Http::respond(accountList($pdo,$userId));
if ($path === '/api/accounts' && $method === 'POST') {
    $b=Http::body(); $type=$b['type']??''; $name=trim($b['name']??''); $opening=filter_var($b['opening_balance_cents']??0,FILTER_VALIDATE_INT);
    if (!$name || !in_array($type,['cash','savings','debit','credit','investment'],true) || $opening===false) Http::fail('Name, account type, and integer opening balance are required.');
    $pdo->beginTransaction(); try { $s=$pdo->prepare('INSERT INTO accounts (user_id,name,type,opening_balance_cents) VALUES (?,?,?,?)');$s->execute([$userId,$name,$type,$opening]);$id=(int)$pdo->lastInsertId(); if ($type==='credit') { $limit=filter_var($b['credit_limit_cents']??null,FILTER_VALIDATE_INT);$sd=filter_var($b['statement_day']??null,FILTER_VALIDATE_INT);$dd=filter_var($b['due_day']??null,FILTER_VALIDATE_INT);if($limit===false||$limit<0||$sd<1||$sd>31||$dd<1||$dd>31) Http::fail('Credit limit, statement day, and due day are required for a card.'); $pdo->prepare('INSERT INTO credit_card_details VALUES (?,?,?,?)')->execute([$id,$limit,$sd,$dd]); } $pdo->commit(); } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack(); throw $e; } Http::respond(accountForUser($pdo,$id,$userId),201);
}
if (preg_match('#^/api/accounts/(\d+)$#',$path,$m) && $method === 'PATCH') {
    $a=accountForUser($pdo,(int)$m[1],$userId); $b=Http::body(); $name=trim($b['name']??$a['name']);
    $opening=array_key_exists('opening_balance_cents',$b)?filter_var($b['opening_balance_cents'],FILTER_VALIDATE_INT):(int)$a['opening_balance_cents'];
    $archived=array_key_exists('is_archived',$b)?(int)(bool)$b['is_archived']:(int)$a['is_archived'];
    if(!$name || $opening===false) Http::fail('Account name and integer opening balance are required.');
    $pdo->beginTransaction(); try {
        $pdo->prepare('UPDATE accounts SET name=?, opening_balance_cents=?, is_archived=? WHERE id=? AND user_id=?')->execute([$name,$opening,$archived,$a['id'],$userId]);
        if ($a['type']==='credit') { $s=$pdo->prepare('SELECT * FROM credit_card_details WHERE account_id=?');$s->execute([$a['id']]);$card=$s->fetch();$limit=array_key_exists('credit_limit_cents',$b)?filter_var($b['credit_limit_cents'],FILTER_VALIDATE_INT):(int)$card['credit_limit_cents'];$sd=array_key_exists('statement_day',$b)?filter_var($b['statement_day'],FILTER_VALIDATE_INT):(int)$card['statement_day'];$dd=array_key_exists('due_day',$b)?filter_var($b['due_day'],FILTER_VALIDATE_INT):(int)$card['due_day'];if($limit===false||$limit<0||$sd<1||$sd>31||$dd<1||$dd>31)Http::fail('Provide a valid credit limit, statement day, and due day.');$pdo->prepare('UPDATE credit_card_details SET credit_limit_cents=?,statement_day=?,due_day=? WHERE account_id=?')->execute([$limit,$sd,$dd,$a['id']]); }
        $pdo->commit();
    } catch(Throwable $e) {if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    Http::respond(accountForUser($pdo,$a['id'],$userId));
}
// A new balance is recorded as a one-sided transfer of the difference: earlier balances and net worth keep their history, and transfers never count as spending or income.
if (preg_match('#^/api/accounts/(\d+)/balance$#',$path,$m) && $method === 'POST') {
    $a=accountForUser($pdo,(int)$m[1],$userId); $b=Http::body(); $target=filter_var($b['balance_cents']??null,FILTER_VALIDATE_INT); $date=$b['occurred_on']??'';
    if($target===false || !DateTimeImmutable::createFromFormat('!Y-m-d',$date)) Http::fail('A balance in whole cents and a date are required.');
    $change=$target-(int)array_column(accountList($pdo,$userId),'balance_cents','id')[$a['id']];
    if($change!==0) $pdo->prepare("INSERT INTO transactions (user_id,type,amount_cents,occurred_on,from_account_id,to_account_id,merchant) VALUES (?,'transfer',?,?,?,?,'Balance adjustment')")->execute([$userId,abs($change),$date,$change<0?$a['id']:null,$change>0?$a['id']:null]);
    Http::respond(['balance_cents'=>$target,'change_cents'=>$change]);
}
if (preg_match('#^/api/accounts/(\d+)$#',$path,$m) && $method === 'DELETE') {
    $a=accountForUser($pdo,(int)$m[1],$userId);
    $s=$pdo->prepare('SELECT id FROM transactions WHERE user_id=? AND (from_account_id=? OR to_account_id=?) LIMIT 1');
    $s->execute([$userId,$a['id'],$a['id']]);
    if($s->fetch()) Http::fail('Accounts with transaction history cannot be deleted. Archive this account instead.',409);
    $pdo->prepare('DELETE FROM accounts WHERE id=? AND user_id=?')->execute([$a['id'],$userId]);
    Http::respond(['ok'=>true]);
}
if (preg_match('#^/api/accounts/(\d+)/delete$#',$path,$m) && $method === 'POST') {
    $a=accountForUser($pdo,(int)$m[1],$userId);
    $s=$pdo->prepare('SELECT id FROM transactions WHERE user_id=? AND (from_account_id=? OR to_account_id=?) LIMIT 1');
    $s->execute([$userId,$a['id'],$a['id']]);
    if($s->fetch()) Http::fail('Accounts with transaction history cannot be deleted. Archive this account instead.',409);
    $pdo->prepare('DELETE FROM accounts WHERE id=? AND user_id=?')->execute([$a['id'],$userId]);
    Http::respond(['ok'=>true]);
}
if (preg_match('#^/api/accounts/(\d+)/statement$#',$path,$m) && $method === 'GET') { $a=accountForUser($pdo,(int)$m[1],$userId);if($a['type']!=='credit')Http::fail('Statements are available only for credit cards.');$s=$pdo->prepare('SELECT * FROM credit_card_details WHERE account_id=?');$s->execute([$a['id']]);$card=$s->fetch();$cycle=BillingCycle::latestClosedCycle((int)$card['statement_day'],(int)$card['due_day'],new DateTimeImmutable('today'));$q=$pdo->prepare("SELECT COALESCE(SUM(CASE WHEN from_account_id=? THEN amount_cents WHEN to_account_id=? THEN -amount_cents ELSE 0 END),0) owed FROM transactions WHERE user_id=? AND occurred_on BETWEEN ? AND ?");$q->execute([$a['id'],$a['id'],$userId,$cycle['start'],$cycle['end']]);$owed=max(0,(int)$q->fetch()['owed']);Http::respond([...$cycle,'amount_due_cents'=>$owed]); }

// Categories
if ($path === '/api/categories' && $method === 'GET') { $s=$pdo->prepare('SELECT id,name FROM categories WHERE user_id=? ORDER BY name');$s->execute([$userId]);Http::respond($s->fetchAll()); }
if ($path === '/api/categories' && $method === 'POST') { $name=trim(Http::body()['name']??'');if(!$name)Http::fail('Category name is required.');try{$s=$pdo->prepare('INSERT INTO categories (user_id,name) VALUES (?,?)');$s->execute([$userId,$name]);}catch(PDOException){Http::fail('This category already exists.',409);}Http::respond(['id'=>(int)$pdo->lastInsertId(),'name'=>$name],201); }

// Transactions
// Pages of 50, as a bare list. with_total=1 wraps a page with the full match count for the ledger; all=1 returns every match for exports.
if ($path === '/api/transactions' && $method === 'GET') { $where=['t.user_id=?'];$params=[$userId];foreach(['from'=>'t.occurred_on >= ?','to'=>'t.occurred_on <= ?','account_id'=>'(t.from_account_id=? OR t.to_account_id=?)','category_id'=>'t.category_id=?','type'=>'t.type=?'] as $key=>$clause)if(!empty($_GET[$key])){ $where[]=$clause; $params[]=$_GET[$key];if($key==='account_id')$params[]=$_GET[$key]; }$totals=null;if(!empty($_GET['with_total'])){$c=$pdo->prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_cents ELSE 0 END),0) AS spent_cents, COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_cents ELSE 0 END),0) AS earned_cents, COALESCE(SUM(CASE WHEN t.type='transfer' THEN t.amount_cents ELSE 0 END),0) AS moved_cents FROM transactions t WHERE ".implode(' AND ',$where));$c->execute($params);$totals=array_map('intval',$c->fetch());}$page=max(1,(int)($_GET['page']??1));$direction=($_GET['sort']??'desc')==='asc'?'ASC':'DESC';$all=!empty($_GET['all']);if(!$all){$params[] = 50; $params[] = ($page-1)*50;}$sql='SELECT t.*, fa.name from_account_name, ta.name to_account_name, c.name category_name FROM transactions t LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id LEFT JOIN categories c ON c.id=t.category_id WHERE '.implode(' AND ',$where)." ORDER BY t.occurred_on $direction, t.id $direction".($all?'':' LIMIT ? OFFSET ?');$s=$pdo->prepare($sql);$s->execute($params);$rows=$s->fetchAll();Http::respond($totals===null?$rows:['rows'=>$rows,...$totals]); }
if ($path === '/api/transactions' && $method === 'POST') { $d=validateTransaction($pdo,Http::body(),$userId);$s=$pdo->prepare('INSERT INTO transactions (user_id,type,amount_cents,occurred_on,is_historical,from_account_id,to_account_id,category_id,merchant,note,exclude_from_insights) VALUES (?,?,?,?,?,?,?,?,?,?,?)');$s->execute([$userId,...array_values($d)]);Http::respond(['id'=>(int)$pdo->lastInsertId(),...$d],201); }
// Importing a file takes two requests: the first shows what would change, and the second saves it only if checking again gives the same answer.
if ($path === '/api/transactions/import' && $method === 'POST') {
    // A form on another site can't send this content type, which matters on a route that can change every transaction at once.
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''), 'application/json')) Http::fail('Send the transactions as JSON.', 415);
    $b=Http::body(); $entries=$b['transactions']??null;
    if (!is_array($entries) || !$entries || !array_is_list($entries)) Http::fail('There are no transactions to import.');
    if (count($entries) > TransactionImport::LIMIT) Http::fail('Import at most '.number_format(TransactionImport::LIMIT).' transactions at a time.');
    $s=$pdo->prepare('SELECT t.id,t.type,t.amount_cents,t.occurred_on,t.is_historical,t.from_account_id,t.to_account_id,t.category_id,t.merchant,t.note,t.exclude_from_insights,fa.name from_account_name,ta.name to_account_name,c.name category_name FROM transactions t LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id LEFT JOIN categories c ON c.id=t.category_id WHERE t.user_id=? ORDER BY t.id'); $s->execute([$userId]);
    // The database matches names, so a file finds whichever account or category the database would treat as the same name.
    $named=function(string $table) use ($pdo,$userId){ $s=$pdo->prepare("SELECT id,name FROM $table WHERE user_id=? AND name=?"); return function(string $name) use ($s,$userId){ $s->execute([$userId,$name]); return $s->fetchAll(); }; };
    $plan=TransactionImport::plan($entries,array_column($s->fetchAll(),null,'id'),$named('accounts'),$named('categories'));
    if (empty($b['apply'])) Http::respond($plan);
    if ($plan['error_count']) Http::fail('Fix the problems in the file before importing it.');
    if (($b['fingerprint']??null)!==$plan['fingerprint']) Http::fail('Your transactions changed after this file was checked. Check it again before importing.',409);
    Http::respond(TransactionImport::save($pdo,$userId,$plan));
}
if (preg_match('#^/api/transactions/(\d+)$#',$path,$m) && in_array($method,['PATCH','DELETE'],true)) { $id=(int)$m[1];$s=$pdo->prepare('SELECT * FROM transactions WHERE id=? AND user_id=?');$s->execute([$id,$userId]);$old=$s->fetch();if(!$old)Http::fail('Transaction not found.',404);if($method==='DELETE'){$pdo->prepare('DELETE FROM transactions WHERE id=? AND user_id=?')->execute([$id,$userId]);Http::respond(['ok'=>true]);}$d=validateTransaction($pdo,[...$old,...Http::body()],$userId);$pdo->prepare('UPDATE transactions SET type=?,amount_cents=?,occurred_on=?,is_historical=?,from_account_id=?,to_account_id=?,category_id=?,merchant=?,note=?,exclude_from_insights=? WHERE id=? AND user_id=?')->execute([...array_values($d),$id,$userId]);Http::respond(['id'=>$id,...$d]); }

// Reporting: transfers never enter spending figures, and expenses hidden from insights are skipped unless include_hidden is set.
if ($path === '/api/insights/summary' && $method === 'GET') { $expr=insightGroup($_GET['group_by']??'month');$where=['t.user_id=?','t.type=\'expense\''];$params=[$userId];if(empty($_GET['include_hidden']))$where[]='t.exclude_from_insights=0';[$dw,$dp]=dateFilters('t.occurred_on');$where=[...$where,...$dw];$params=[...$params,...$dp];$sql="SELECT $expr AS label, SUM(t.amount_cents) AS total_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE ".implode(' AND ',$where)." GROUP BY $expr ORDER BY label";$s=$pdo->prepare($sql);$s->execute($params);Http::respond($s->fetchAll()); }
// The transactions behind one chart bar (hidden ones included, so they can be switched back on), or every hidden transaction.
// Bars are expenses only, unless flow is set for the income-vs-expenses chart.
if ($path === '/api/insights/transactions' && $method === 'GET') { $where=['t.user_id=?',(!empty($_GET['hidden'])||!empty($_GET['flow']))?"t.type IN ('income','expense')":"t.type='expense'"];$params=[$userId];if(!empty($_GET['hidden']))$where[]='t.exclude_from_insights=1';else{$label=$_GET['label']??'';if($label==='')Http::fail('Choose a month or category to review.');$group=$_GET['group_by']??'month';if($group==='month'||$group==='day'){array_push($where,'t.occurred_on >= ?','t.occurred_on < ?');array_push($params,...insightDates($group,$label));}else{$where[]=insightGroup($group).' = ?';$params[]=$label;}}$sql='SELECT t.*, fa.name from_account_name, ta.name to_account_name, c.name category_name FROM transactions t LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id LEFT JOIN categories c ON c.id=t.category_id WHERE '.implode(' AND ',$where).' ORDER BY t.amount_cents DESC, t.occurred_on DESC, t.id DESC';$s=$pdo->prepare($sql);$s->execute($params);Http::respond($s->fetchAll()); }
if ($path === '/api/insights/cashflow' && $method === 'GET') { [$dw,$dp]=dateFilters('t.occurred_on');$month=insightGroup('month');$s=$pdo->prepare("SELECT $month AS month, SUM(CASE WHEN t.type='income' THEN t.amount_cents ELSE 0 END) AS income_cents, SUM(CASE WHEN t.type='expense' THEN t.amount_cents ELSE 0 END) AS expense_cents FROM transactions t WHERE ".implode(' AND ',['t.user_id=?',"t.type IN ('income','expense')",'t.exclude_from_insights=0',...$dw])." GROUP BY $month ORDER BY month");$s->execute([$userId,...$dp]);Http::respond($s->fetchAll()); }
if ($path === '/api/insights/category-trends' && $method === 'GET') { [$dw,$dp]=dateFilters('t.occurred_on');$month=insightGroup('month');$category=insightGroup('category');$s=$pdo->prepare("SELECT $month AS month, $category AS category, SUM(t.amount_cents) AS total_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE ".implode(' AND ',['t.user_id=?',"t.type='expense'",'t.exclude_from_insights=0',...$dw])." GROUP BY $month, $category ORDER BY month");$s->execute([$userId,...$dp]);Http::respond($s->fetchAll()); }
// Net worth and card use follow real balances, so transactions hidden from insights still count here.
if ($path === '/api/insights/net-worth' && $method === 'GET') { $s=$pdo->prepare('SELECT COALESCE(SUM(opening_balance_cents),0) FROM accounts WHERE user_id=?');$s->execute([$userId]);$opening=(int)$s->fetchColumn();$month=insightGroup('month');$s=$pdo->prepare("SELECT $month AS month, SUM(CASE WHEN t.to_account_id IS NOT NULL THEN t.amount_cents ELSE 0 END) - SUM(CASE WHEN t.from_account_id IS NOT NULL THEN t.amount_cents ELSE 0 END) AS net_cents FROM transactions t WHERE t.user_id=? GROUP BY $month ORDER BY month");$s->execute([$userId]);Http::respond(['opening_cents'=>$opening,'months'=>$s->fetchAll()]); }
// A statement's balance is everything owed on its closing day; payments made after it count toward what remains due.
if ($path === '/api/insights/cards' && $method === 'GET') { $today=DateTimeImmutable::createFromFormat('!Y-m-d',$_GET['as_of']??'')?:new DateTimeImmutable('today');$cards=[];foreach(accountList($pdo,$userId) as $a){if($a['type']!=='credit'||(int)$a['is_archived'])continue;$sd=(int)$a['statement_day'];$dd=(int)$a['due_day'];$last=BillingCycle::latestClosedCycle($sd,$dd,$today);$q=$pdo->prepare('SELECT COALESCE(SUM(CASE WHEN occurred_on <= ? THEN (CASE WHEN to_account_id=? THEN amount_cents ELSE -amount_cents END) ELSE 0 END),0) AS flow_at_close, COALESCE(SUM(CASE WHEN occurred_on > ? AND occurred_on <= ? AND to_account_id=? THEN amount_cents ELSE 0 END),0) AS paid_since FROM transactions WHERE user_id=? AND (from_account_id=? OR to_account_id=?)');$q->execute([$last['end'],$a['id'],$last['end'],$today->format('Y-m-d'),$a['id'],$userId,$a['id'],$a['id']]);$r=$q->fetch();$owed=max(0,-((int)$a['opening_balance_cents']+(int)$r['flow_at_close']));$cards[]=['id'=>(int)$a['id'],'name'=>$a['name'],'balance_cents'=>(int)$a['balance_cents'],'credit_limit_cents'=>(int)$a['credit_limit_cents'],'last_statement'=>[...$last,'owed_cents'=>$owed,'remaining_cents'=>max(0,$owed-(int)$r['paid_since'])],'current_cycle'=>BillingCycle::currentCycle($sd,$dd,$today)];}Http::respond($cards); }
Http::fail('Route not found.',404);
