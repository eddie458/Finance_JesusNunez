<?php
declare(strict_types=1);
require __DIR__ . '/src/Database.php'; require __DIR__ . '/src/Http.php'; require __DIR__ . '/src/Auth.php'; require __DIR__ . '/src/AdminBootstrap.php'; require __DIR__ . '/src/BillingCycle.php';

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
    $date = $data['occurred_on'] ?? ''; $from = $data['from_account_id'] ?? null; $to = $data['to_account_id'] ?? null; $historical = filter_var($data['is_historical'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (!in_array($type, ['expense','income','transfer'], true) || $amount === false || $amount <= 0 || !DateTimeImmutable::createFromFormat('!Y-m-d', $date)) Http::fail('Type, positive amount, and valid date are required.');
    $from = $from === null || $from === '' ? null : (int)$from; $to = $to === null || $to === '' ? null : (int)$to;
    if ($historical) {
        if ($from || $to) Http::fail('Historical entries cannot be connected to an account.');
    } elseif (($type === 'expense' && (!$from || $to)) || ($type === 'income' && ($from || !$to)) || ($type === 'transfer' && (!$from || !$to || $from === $to))) Http::fail('The selected accounts do not match this transaction type.');
    foreach (array_filter([$from, $to]) as $accountId) accountForUser($pdo, $accountId, $userId);
    $category = empty($data['category_id']) ? null : (int)$data['category_id'];
    if ($category) { $s=$pdo->prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?'); $s->execute([$category,$userId]); if (!$s->fetch()) Http::fail('Category not found.', 404); }
    return ['type'=>$type,'amount_cents'=>$amount,'occurred_on'=>$date,'is_historical'=>(int)$historical,'from_account_id'=>$from,'to_account_id'=>$to,'category_id'=>$category,'merchant'=>trim($data['merchant'] ?? '') ?: null,'note'=>trim($data['note'] ?? '') ?: null];
}
function accountList(PDO $pdo, int $userId): array {
    $sql = "SELECT a.*, a.opening_balance_cents + COALESCE(SUM(CASE WHEN t.to_account_id=a.id THEN t.amount_cents ELSE 0 END),0) - COALESCE(SUM(CASE WHEN t.from_account_id=a.id THEN t.amount_cents ELSE 0 END),0) AS balance_cents, c.credit_limit_cents, c.statement_day, c.due_day FROM accounts a LEFT JOIN transactions t ON (t.from_account_id=a.id OR t.to_account_id=a.id) AND t.user_id=a.user_id LEFT JOIN credit_card_details c ON c.account_id=a.id WHERE a.user_id=? GROUP BY a.id ORDER BY a.is_archived, a.name";
    $s=$pdo->prepare($sql); $s->execute([$userId]); return $s->fetchAll();
}

// Authentication
if ($path === '/api/auth/login' && $method === 'POST') { $b=Http::body(); $s=$pdo->prepare('SELECT * FROM users WHERE email=?'); $s->execute([strtolower(trim($b['email']??''))]); $u=$s->fetch(); if (!$u || !password_verify($b['password']??'', $u['password_hash'])) Http::fail('Invalid email or password.',401); Auth::login((int)$u['id']); Http::respond(['id'=>(int)$u['id'],'email'=>$u['email'],'base_currency'=>$u['base_currency'],'role'=>$u['role']]); }
if ($path === '/api/auth/logout' && $method === 'POST') { Auth::logout(); Http::respond(['ok'=>true]); }
if ($path === '/api/auth/me' && $method === 'GET') Http::respond(Auth::currentUser($pdo));

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
if ($path === '/api/transactions' && $method === 'GET') { $where=['t.user_id=?'];$params=[$userId];foreach(['from'=>'t.occurred_on >= ?','to'=>'t.occurred_on <= ?','account_id'=>'(t.from_account_id=? OR t.to_account_id=?)','category_id'=>'t.category_id=?','type'=>'t.type=?'] as $key=>$clause)if(!empty($_GET[$key])){ $where[]=$clause; $params[]=$_GET[$key];if($key==='account_id')$params[]=$_GET[$key]; }$page=max(1,(int)($_GET['page']??1));$direction=($_GET['sort']??'desc')==='asc'?'ASC':'DESC';$params[] = 50; $params[] = ($page-1)*50;$sql='SELECT t.*, fa.name from_account_name, ta.name to_account_name, c.name category_name FROM transactions t LEFT JOIN accounts fa ON fa.id=t.from_account_id LEFT JOIN accounts ta ON ta.id=t.to_account_id LEFT JOIN categories c ON c.id=t.category_id WHERE '.implode(' AND ',$where)." ORDER BY t.occurred_on $direction, t.id $direction LIMIT ? OFFSET ?";$s=$pdo->prepare($sql);$s->execute($params);Http::respond($s->fetchAll()); }
if ($path === '/api/transactions' && $method === 'POST') { $d=validateTransaction($pdo,Http::body(),$userId);$s=$pdo->prepare('INSERT INTO transactions (user_id,type,amount_cents,occurred_on,is_historical,from_account_id,to_account_id,category_id,merchant,note) VALUES (?,?,?,?,?,?,?,?,?,?)');$s->execute([$userId,...array_values($d)]);Http::respond(['id'=>(int)$pdo->lastInsertId(),...$d],201); }
if (preg_match('#^/api/transactions/(\d+)$#',$path,$m) && in_array($method,['PATCH','DELETE'],true)) { $id=(int)$m[1];$s=$pdo->prepare('SELECT * FROM transactions WHERE id=? AND user_id=?');$s->execute([$id,$userId]);$old=$s->fetch();if(!$old)Http::fail('Transaction not found.',404);if($method==='DELETE'){$pdo->prepare('DELETE FROM transactions WHERE id=? AND user_id=?')->execute([$id,$userId]);Http::respond(['ok'=>true]);}$d=validateTransaction($pdo,[...$old,...Http::body()],$userId);$pdo->prepare('UPDATE transactions SET type=?,amount_cents=?,occurred_on=?,is_historical=?,from_account_id=?,to_account_id=?,category_id=?,merchant=?,note=? WHERE id=? AND user_id=?')->execute([...array_values($d),$id,$userId]);Http::respond(['id'=>$id,...$d]); }

// Reporting: transfers never enter spending figures.
if ($path === '/api/insights/summary' && $method === 'GET') { $group=$_GET['group_by']??'month';$fields=['month'=>"DATE_FORMAT(t.occurred_on, '%Y-%m')",'category'=>'COALESCE(c.name, \'Uncategorized\')','merchant'=>"COALESCE(t.merchant, 'Unspecified')"];if(!isset($fields[$group]))Http::fail('Invalid grouping.');$where=['t.user_id=?','t.type=\'expense\''];$params=[$userId];foreach(['from'=>'>=','to'=>'<='] as $key=>$op)if(!empty($_GET[$key])){$where[]="t.occurred_on $op ?";$params[]=$_GET[$key];}$expr=$fields[$group];$sql="SELECT $expr AS label, SUM(t.amount_cents) AS total_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE ".implode(' AND ',$where)." GROUP BY $expr ORDER BY label";$s=$pdo->prepare($sql);$s->execute($params);Http::respond($s->fetchAll()); }
Http::fail('Route not found.',404);
