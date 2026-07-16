<?php
declare(strict_types=1);

final class BillingCycle {
    /** Returns the most recent closed statement period, clamping days such as Feb 31. */
    public static function latestClosedCycle(int $statementDay, int $dueDay, DateTimeImmutable $asOf): array {
        self::validateDays($statementDay, $dueDay);
        $close = self::dayInMonth((int)$asOf->format('Y'), (int)$asOf->format('n'), $statementDay);
        if ($close > $asOf->setTime(0, 0)) $close = self::dayInMonth((int)$asOf->modify('first day of last month')->format('Y'), (int)$asOf->modify('first day of last month')->format('n'), $statementDay);
        $previousMonth = $close->modify('first day of last month');
        $previousClose = self::dayInMonth((int)$previousMonth->format('Y'), (int)$previousMonth->format('n'), $statementDay);
        $start = $previousClose->modify('+1 day');
        $dueMonth = $close->modify('first day of next month');
        // A due day after the close day belongs to the close month (e.g. close 5, due 20).
        if ($dueDay > $statementDay) $dueMonth = $close->modify('first day of this month');
        $due = self::dayInMonth((int)$dueMonth->format('Y'), (int)$dueMonth->format('n'), $dueDay);
        return ['start' => $start->format('Y-m-d'), 'end' => $close->format('Y-m-d'), 'due_on' => $due->format('Y-m-d')];
    }
    private static function dayInMonth(int $year, int $month, int $day): DateTimeImmutable {
        $lastDay = (int)(new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month)))->format('t');
        return new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, min($day, $lastDay)));
    }
    private static function validateDays(int $statementDay, int $dueDay): void {
        if ($statementDay < 1 || $statementDay > 31 || $dueDay < 1 || $dueDay > 31) throw new InvalidArgumentException('Billing days must be between 1 and 31.');
    }
}
