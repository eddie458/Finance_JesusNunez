<?php
declare(strict_types=1);

// Keeps sign-ins in the database for as long as Auth says. PHP's own session files can be cleared by the host after 24 idle minutes.
final class SessionStore implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface {
    public const TABLE = <<<'SQL'
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
          data BLOB NOT NULL,
          last_active INT UNSIGNED NOT NULL,
          INDEX idx_sessions_last_active (last_active)
        ) ENGINE=InnoDB
        SQL;

    private ?array $found = null; // the last session looked up, so checking an id and reading it take one query

    private function __construct(private PDO $pdo, private int $lifetime) {}

    // Creates the table the first time. Null when it can't, and PHP's session files are used as before.
    public static function connect(PDO $pdo, int $lifetime): ?self {
        try { $pdo->query('SELECT 1 FROM sessions LIMIT 0'); }
        catch (PDOException) { try { $pdo->exec(self::TABLE); } catch (PDOException) { return null; } }
        return new self($pdo, $lifetime);
    }

    public function open(string $path, string $name): bool { return true; }
    public function close(): bool { return true; }
    public function validateId(string $id): bool { return $this->find($id) !== null; }
    public function read(string $id): string|false { return $this->find($id) ?? ''; }

    public function write(string $id, string $data): bool {
        // Nobody is signed in to an empty session, so there is nothing to keep.
        if ($data === '') return $this->destroy($id);
        $now = time();
        return $this->run('INSERT INTO sessions (id, data, last_active) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?, last_active = ?', [$id, $data, $now, $data, $now]);
    }

    // Auth renews a signed-in session once an hour, which writes it, so the visits in between don't have to.
    public function updateTimestamp(string $id, string $data): bool { return true; }

    public function destroy(string $id): bool { return $this->run('DELETE FROM sessions WHERE id = ?', [$id]); }

    public function gc(int $max_lifetime): int|false {
        try { $s = $this->pdo->prepare('DELETE FROM sessions WHERE last_active <= ?'); $s->execute([time() - $max_lifetime]); return $s->rowCount(); }
        catch (PDOException) { return false; }
    }

    private function find(string $id): ?string {
        if ($this->found && $this->found[0] === $id) return $this->found[1];
        $s = $this->pdo->prepare('SELECT data FROM sessions WHERE id = ? AND last_active > ?'); $s->execute([$id, time() - $this->lifetime]);
        $data = $s->fetchColumn();
        $this->found = [$id, $data === false ? null : (string) $data];
        return $this->found[1];
    }

    // Sessions are saved after the response has gone out, so a failure goes back to PHP as false rather than as an exception.
    private function run(string $sql, array $params): bool {
        $this->found = null;
        try { $this->pdo->prepare($sql)->execute($params); return true; } catch (PDOException) { return false; }
    }
}
