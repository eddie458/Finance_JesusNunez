<?php
declare(strict_types=1);

// Works out what importing a transactions file would change, then saves exactly that. An entry with an id updates
// that transaction, but only the fields it lists and only where they differ. An entry without an id is added.
// Transactions the file leaves out stay as they are, so an import never deletes anything.
final class TransactionImport {
    public const LIMIT = 10000;
    private const ERRORS_SHOWN = 100;
    // The order a file lists them in, which is also the order changes are shown in.
    private const FIELDS = ['date','type','amount','description','category','from_account','to_account','note','changes_balances','hidden_from_insights'];
    private const WHOLE_DIGITS = 13; // past this, an amount stops being exact as a JSON number
    private const BLANK = ['type'=>null,'amount_cents'=>null,'occurred_on'=>null,'is_historical'=>0,'from_account_id'=>null,'to_account_id'=>null,'category_id'=>null,'merchant'=>null,'note'=>null,'exclude_from_insights'=>0,'from_account_name'=>null,'to_account_name'=>null,'category_name'=>null,'new_category'=>null];

    /**
     * @param list<mixed> $entries the file's transactions, as decoded JSON
     * @param array<int, array> $ledger the person's transactions by id, with from_account_name, to_account_name and category_name
     * @param callable(string): list<array> $accounts the person's accounts with this name, compared the way the database compares names
     * @param callable(string): list<array> $categories the same for categories
     */
    public static function plan(array $entries, array $ledger, callable $accounts, callable $categories): array {
        $find = ['account' => self::remembered($accounts), 'category' => self::remembered($categories)];
        $similar = []; foreach ($ledger as $id => $row) $similar[self::likeness(self::clean($row))] ??= (int)$id;
        $plan = ['entries' => count($entries), 'unchanged' => 0, 'updates' => [], 'additions' => [], 'new_categories' => [], 'errors' => []]; $seen = [];
        foreach ($entries as $index => $entry) {
            $number = $index + 1; $id = null;
            try {
                if (!is_array($entry) || (array_is_list($entry) && $entry !== [])) throw new InvalidArgumentException('This isn’t a transaction. Each entry is an object with fields like "date" and "amount".');
                $id = self::id($entry['id'] ?? null);
                if ($id !== null && isset($seen[$id])) throw new InvalidArgumentException("Entry {$seen[$id]} already has id $id. A transaction can appear only once.");
                if ($id !== null) $seen[$id] = $number;
                $values = self::values($entry);
                if ($id === null) {
                    $missing = array_values(array_diff(['date','type','amount'], array_keys($values)));
                    if ($missing) throw new InvalidArgumentException('A new transaction needs '.self::series(array_map(fn($field) => "\"$field\"", $missing)).'.');
                    $row = self::merge(self::BLANK, $values, $find); self::check($row);
                    $plan['additions'][] = ['entry' => $number, 'transaction' => $row, 'matches' => $similar[self::likeness($row)] ?? null];
                } else {
                    $old = isset($ledger[$id]) ? self::clean($ledger[$id]) : throw new InvalidArgumentException("There’s no transaction with id $id in your ledger. Remove the id to add this as a new transaction.");
                    $row = self::merge($old, $values, $find); $changes = self::changes($old, $row);
                    if (!$changes) { $plan['unchanged']++; continue; }
                    if (self::isAdjustment($old)) throw new InvalidArgumentException('This is a balance adjustment, which can’t be edited. Delete it in Fluent to undo it, or use Update balance on the Accounts page.');
                    self::check($row);
                    $plan['updates'][] = ['entry' => $number, 'id' => $id, 'transaction' => $row, 'changes' => $changes];
                }
                if ($row['new_category'] !== null) $plan['new_categories'][self::fold($row['new_category'])] ??= $row['new_category'];
            } catch (InvalidArgumentException $e) {
                $plan['errors'][] = ['entry' => $number, 'id' => $id, 'message' => $e->getMessage()];
            }
        }
        $plan['new_categories'] = array_values($plan['new_categories']);
        $plan['error_count'] = count($plan['errors']); $plan['errors'] = array_slice($plan['errors'], 0, self::ERRORS_SHOWN);
        // Saving repeats the check and compares this, so a ledger that changed in between is never written over unseen.
        $plan['fingerprint'] = hash('sha256', json_encode($plan, JSON_INVALID_UTF8_SUBSTITUTE));
        return $plan;
    }

    // One database transaction: either the whole file is saved or none of it is.
    public static function save(PDO $pdo, int $userId, array $plan): array {
        $pdo->beginTransaction();
        try {
            $find = $pdo->prepare('SELECT id FROM categories WHERE user_id=? AND name=?'); $create = $pdo->prepare('INSERT INTO categories (user_id,name) VALUES (?,?)');
            $categoryIds = []; $created = 0;
            foreach ($plan['new_categories'] as $name) {
                // Two spellings the database counts as one name share the category the first one created.
                $find->execute([$userId, $name]); $id = $find->fetchColumn();
                if ($id === false) { $create->execute([$userId, $name]); $id = $pdo->lastInsertId(); $created++; }
                $categoryIds[self::fold($name)] = (int)$id;
            }
            $columns = fn(array $t) => [$t['type'], $t['amount_cents'], $t['occurred_on'], $t['is_historical'], $t['from_account_id'], $t['to_account_id'], $t['new_category'] === null ? $t['category_id'] : $categoryIds[self::fold($t['new_category'])], $t['merchant'], $t['note'], $t['exclude_from_insights']];
            $update = $pdo->prepare('UPDATE transactions SET type=?,amount_cents=?,occurred_on=?,is_historical=?,from_account_id=?,to_account_id=?,category_id=?,merchant=?,note=?,exclude_from_insights=? WHERE id=? AND user_id=?');
            foreach ($plan['updates'] as $u) $update->execute([...$columns($u['transaction']), $u['id'], $userId]);
            $insert = $pdo->prepare('INSERT INTO transactions (user_id,type,amount_cents,occurred_on,is_historical,from_account_id,to_account_id,category_id,merchant,note,exclude_from_insights) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            foreach ($plan['additions'] as $a) $insert->execute([$userId, ...$columns($a['transaction'])]);
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        return ['updated' => count($plan['updates']), 'added' => count($plan['additions']), 'categories_added' => $created];
    }

    private static function values(array $entry): array {
        $values = [];
        foreach ($entry as $field => $value) {
            if ($field === 'id') continue;
            $values[$field] = match ($field) {
                'date' => self::date($value),
                'type' => in_array($value, ['expense','income','transfer'], true) ? $value : throw new InvalidArgumentException('"type" is "expense", "income" or "transfer".'),
                'amount' => self::cents($value),
                'description' => self::text($value, $field, 120),
                'category' => self::text($value, $field, 60),
                'from_account', 'to_account' => self::text($value, $field),
                'note' => self::text($value, $field, 65535, true),
                'changes_balances', 'hidden_from_insights' => is_bool($value) ? $value : throw new InvalidArgumentException("\"$field\" is true or false."),
                default => throw new InvalidArgumentException("\"$field\" isn’t a field Fluent knows. Check its spelling."),
            };
        }
        return $values;
    }

    private static function id(mixed $value): ?int {
        if ($value === null) return null;
        if (is_int($value) && $value > 0) return $value;
        if (is_string($value) && preg_match('/^[1-9]\d{0,17}$/', $value)) return (int)$value;
        throw new InvalidArgumentException('"id" is the number a transaction has in an export. Leave it out to add a new transaction.');
    }

    private static function date(mixed $value): string {
        $date = is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if (!$date || $date->format('Y-m-d') !== $value || $value < '1900-01-01' || $value > '2100-12-31') throw new InvalidArgumentException('"date" is a real day, written like 2026-11-05.');
        return $value;
    }

    // Exact to the cent. A JSON number like 45.5 arrives as a float, so it has to print back as itself with two decimals.
    private static function cents(mixed $value): int {
        $text = match (true) {
            is_int($value) => (string)$value,
            is_float($value) => (float)sprintf('%.2f', $value) === $value ? sprintf('%.2f', $value) : '',
            is_string($value) => trim($value),
            default => '',
        };
        if (!preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $text, $parts)) throw new InvalidArgumentException('"amount" is a positive number with up to two decimals, like 45.50. The type says which way the money moves.');
        $whole = ltrim($parts[1], '0');
        if (strlen($whole) > self::WHOLE_DIGITS) throw new InvalidArgumentException('"amount" is too large.');
        $cents = (int)$whole * 100 + (int)str_pad($parts[2] ?? '', 2, '0');
        if ($cents === 0) throw new InvalidArgumentException('"amount" has to be more than zero.');
        return $cents;
    }

    private static function text(mixed $value, string $field, ?int $limit = null, bool $bytes = false): ?string {
        if ($value === null) return null;
        if (!is_string($value)) throw new InvalidArgumentException("\"$field\" is text, or null to leave it empty.");
        $value = trim($value);
        if ($value === '') return null;
        if ($limit !== null && ($bytes ? strlen($value) : preg_match_all('/./su', $value)) > $limit) throw new InvalidArgumentException($bytes ? "\"$field\" is too long." : "\"$field\" can be at most $limit characters.");
        return $value;
    }

    // A row as the database holds it, in the same shape merge() builds, so comparing the two finds real changes only.
    private static function clean(array $t): array {
        $id = fn($v) => $v === null ? null : (int)$v;
        $text = fn($v) => $v === null || trim((string)$v) === '' ? null : trim((string)$v);
        return ['type'=>$t['type'],'amount_cents'=>(int)$t['amount_cents'],'occurred_on'=>(string)$t['occurred_on'],'is_historical'=>(int)(bool)$t['is_historical'],'from_account_id'=>$id($t['from_account_id']),'to_account_id'=>$id($t['to_account_id']),'category_id'=>$id($t['category_id']),'merchant'=>$text($t['merchant']),'note'=>$text($t['note']),'exclude_from_insights'=>(int)(bool)$t['exclude_from_insights'],'from_account_name'=>$t['from_account_name'] ?? null,'to_account_name'=>$t['to_account_name'] ?? null,'category_name'=>$t['category_name'] ?? null,'new_category'=>null];
    }

    private static function merge(array $row, array $values, array $find): array {
        foreach ($values as $field => $value) {
            switch ($field) {
                case 'date': $row['occurred_on'] = $value; break;
                case 'type': $row['type'] = $value; break;
                case 'amount': $row['amount_cents'] = $value; break;
                case 'description': $row['merchant'] = $value; break;
                case 'note': $row['note'] = $value; break;
                case 'changes_balances': $row['is_historical'] = (int)!$value; break;
                case 'hidden_from_insights': $row['exclude_from_insights'] = (int)$value; break;
                case 'from_account': case 'to_account':
                    $side = $field === 'from_account' ? 'from' : 'to'; $account = $value === null ? null : self::account($find['account']($value), $value);
                    $row["{$side}_account_id"] = $account === null ? null : (int)$account['id']; $row["{$side}_account_name"] = $account['name'] ?? null;
                    break;
                case 'category':
                    // The app shows a missing category as Uncategorized, so that name means none rather than a new category.
                    $found = $value === null ? [] : $find['category']($value);
                    $row['category_id'] = $found ? (int)$found[0]['id'] : null;
                    $row['new_category'] = !$found && $value !== null && strcasecmp($value, 'Uncategorized') !== 0 ? $value : null;
                    $row['category_name'] = $found ? $found[0]['name'] : $row['new_category'];
                    break;
            }
        }
        return $row;
    }

    private static function account(array $matches, string $name): array {
        if (count($matches) === 1) return $matches[0];
        throw new InvalidArgumentException($matches ? "More than one account is named \"$name\". Rename one in Fluent first." : "There’s no account named \"$name\". Check the spelling, or add the account on the Accounts page first.");
    }

    // The same rules the app follows when a transaction is saved there.
    private static function check(array $t): void {
        $type = $t['type']; $from = $t['from_account_id'] !== null; $to = $t['to_account_id'] !== null; $offBalance = (bool)$t['is_historical'];
        $problem = match (true) {
            $type === 'transfer' && $offBalance => 'A transfer always changes balances, so "changes_balances" has to be true.',
            $offBalance && ($from || $to) => 'A transaction that doesn’t change balances has no accounts. Set "from_account" and "to_account" to null, or set "changes_balances" to true.',
            $offBalance => null,
            $type === 'expense' && !$from => 'An expense needs a "from_account", or set "changes_balances" to false.',
            $type === 'expense' && $to => 'An expense only leaves an account. Set "to_account" to null.',
            $type === 'income' && !$to => 'Income needs a "to_account", or set "changes_balances" to false.',
            $type === 'income' && $from => 'Income only enters an account. Set "from_account" to null.',
            $type === 'transfer' && (!$from || !$to) => 'A transfer needs a "from_account" and a "to_account".',
            $type === 'transfer' && $t['from_account_id'] === $t['to_account_id'] => 'A transfer needs two different accounts.',
            default => null,
        } ?? match (true) {
            $type !== 'expense' && ($t['category_id'] !== null || $t['new_category'] !== null) => 'Only expenses have a category. Set "category" to null.',
            $type === 'transfer' && (bool)$t['exclude_from_insights'] => 'Transfers never count in insights, so "hidden_from_insights" has to be false.',
            default => null,
        };
        if ($problem !== null) throw new InvalidArgumentException($problem);
    }

    // Names compare safely: merge() swaps the file's spelling of an account or category for the database's own.
    private static function changes(array $old, array $row): array {
        $changes = [];
        foreach (self::FIELDS as $field) if (($from = self::shown($old, $field)) !== ($to = self::shown($row, $field))) $changes[] = ['field' => $field, 'from' => $from, 'to' => $to];
        return $changes;
    }

    private static function shown(array $row, string $field): mixed {
        return match ($field) {
            'date' => $row['occurred_on'], 'type' => $row['type'], 'amount' => $row['amount_cents'],
            'description' => $row['merchant'], 'note' => $row['note'], 'category' => $row['category_name'],
            'from_account' => $row['from_account_name'], 'to_account' => $row['to_account_name'],
            'changes_balances' => !$row['is_historical'], 'hidden_from_insights' => (bool)$row['exclude_from_insights'],
        };
    }

    // A balance update is a transfer with one side empty, and it only means something next to the balance it set.
    private static function isAdjustment(array $t): bool { return $t['type'] === 'transfer' && ($t['from_account_id'] === null) !== ($t['to_account_id'] === null); }

    // Matching day, amount, accounts and description: likely the same transaction added twice, for example by importing a file again.
    private static function likeness(array $t): string { return json_encode([$t['type'], $t['amount_cents'], $t['occurred_on'], $t['from_account_id'], $t['to_account_id'], self::fold((string)$t['merchant'])], JSON_INVALID_UTF8_SUBSTITUTE); }

    private static function remembered(callable $find): callable {
        $known = [];
        return function (string $name) use ($find, &$known): array { return $known[$name] ??= $find($name); };
    }

    private static function fold(string $text): string { return function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text); }

    private static function series(array $items): string { return count($items) < 2 ? implode('', $items) : implode(', ', array_slice($items, 0, -1)).' and '.end($items); }
}
