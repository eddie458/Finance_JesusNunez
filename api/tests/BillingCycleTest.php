<?php
require dirname(__DIR__) . '/src/BillingCycle.php';

function expect(array $actual, array $expected, string $name): void { if ($actual !== $expected) throw new RuntimeException("$name failed: " . json_encode($actual)); echo "✓ $name\n"; }
expect(BillingCycle::latestClosedCycle(15, 5, new DateTimeImmutable('2026-02-20')), ['start'=>'2026-01-16','end'=>'2026-02-15','due_on'=>'2026-03-05'], 'due rolls into next month');
expect(BillingCycle::latestClosedCycle(31, 5, new DateTimeImmutable('2026-03-01')), ['start'=>'2026-02-01','end'=>'2026-02-28','due_on'=>'2026-03-05'], 'statement day clamps in February');
expect(BillingCycle::latestClosedCycle(5, 20, new DateTimeImmutable('2026-07-06')), ['start'=>'2026-06-06','end'=>'2026-07-05','due_on'=>'2026-07-20'], 'later due day stays in close month');
