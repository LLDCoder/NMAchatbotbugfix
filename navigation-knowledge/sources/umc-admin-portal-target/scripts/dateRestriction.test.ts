import assert from "node:assert/strict";
import test from "node:test";
import moment from "moment";
import {
  exceedsDateRangeDays,
  getDisabledDateInputValue,
  isDateAfterMonthsFromToday,
  isDateWithinTenDaysFromToday,
  mergeDisabledDateWithRestriction,
} from "../src/components/designable/src/utils/dateRestriction.ts";

const today = moment("2026-07-16", "YYYY-MM-DD", true);

test("disables today through the tenth day from today", () => {
  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-07-16", "YYYY-MM-DD", true),
      today,
    ),
    true,
  );
  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-07-26", "YYYY-MM-DD", true),
      today,
    ),
    true,
  );
});

test("allows dates after the tenth day from today", () => {
  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-07-27", "YYYY-MM-DD", true),
      today,
    ),
    false,
  );
});

test("allows August 30 when today is August 19", () => {
  const august19 = moment("2026-08-19", "YYYY-MM-DD", true);

  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-08-28", "YYYY-MM-DD", true),
      august19,
    ),
    true,
  );
  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-08-29", "YYYY-MM-DD", true),
      august19,
    ),
    true,
  );
  assert.equal(
    isDateWithinTenDaysFromToday(
      moment("2026-08-30", "YYYY-MM-DD", true),
      august19,
    ),
    false,
  );
});

test("allows the six-month boundary and disables dates after it", () => {
  assert.equal(
    isDateAfterMonthsFromToday(
      moment("2027-01-16", "YYYY-MM-DD", true),
      6,
      today,
    ),
    false,
  );
  assert.equal(
    isDateAfterMonthsFromToday(
      moment("2027-01-17", "YYYY-MM-DD", true),
      6,
      today,
    ),
    true,
  );
});

test("merges the six-month rule with an existing disabled-date predicate", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    { withinSixMonthsFromToday: true },
    (current) => current.isBefore(today, "day"),
    { today },
  );

  assert.equal(disabledDate?.(today.clone().subtract(1, "day")), true);
  assert.equal(disabledDate?.(today.clone().add(6, "months")), false);
  assert.equal(
    disabledDate?.(today.clone().add(6, "months").add(1, "day")),
    true,
  );
});

test("allows a 90-day date range and rejects a 91-day range", () => {
  const start = moment("2026-08-01", "YYYY-MM-DD", true);

  assert.equal(
    exceedsDateRangeDays(start, start.clone().add(90, "days"), 90),
    false,
  );
  assert.equal(
    exceedsDateRangeDays(start, start.clone().add(91, "days"), 90),
    true,
  );
});

test("supports before and after today with an optional today boundary", () => {
  const beforeToday = mergeDisabledDateWithRestriction(
    { beforeToday: true },
    undefined,
    { today },
  );
  const beforeIncludingToday = mergeDisabledDateWithRestriction(
    { beforeToday: true, includeToday: true },
    undefined,
    { today },
  );
  const afterToday = mergeDisabledDateWithRestriction(
    { afterToday: true },
    undefined,
    { today },
  );
  const afterIncludingToday = mergeDisabledDateWithRestriction(
    { afterToday: true, includeToday: true },
    undefined,
    { today },
  );

  assert.equal(beforeToday?.(today.clone().subtract(1, "day")), false);
  assert.equal(beforeToday?.(today), true);
  assert.equal(beforeIncludingToday?.(today), false);
  assert.equal(afterToday?.(today), true);
  assert.equal(afterToday?.(today.clone().add(1, "day")), false);
  assert.equal(afterIncludingToday?.(today), false);
});

test("gives the ten-day rule priority over conflicting restrictions", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    {
      beforeToday: true,
      afterToday: true,
      includeToday: true,
      tenDaysFromToday: true,
    },
    undefined,
    { today },
  );

  assert.equal(disabledDate?.(today.clone().add(10, "days")), true);
  assert.equal(disabledDate?.(today.clone().add(11, "days")), false);
});

test("combines the ten-day and six-month rules", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    {
      tenDaysFromToday: true,
      withinSixMonthsFromToday: true,
    },
    undefined,
    { today },
  );

  assert.equal(disabledDate?.(today.clone().add(10, "days")), true);
  assert.equal(disabledDate?.(today.clone().add(11, "days")), false);
  assert.equal(disabledDate?.(today.clone().add(6, "months")), false);
  assert.equal(
    disabledDate?.(today.clone().add(6, "months").add(1, "day")),
    true,
  );
});

test("lets a configured restriction replace the filming start-date fallback", () => {
  const disablePastDates = (current: moment.Moment) =>
    current.isBefore(today, "day");
  const withoutRestriction = mergeDisabledDateWithRestriction(
    undefined,
    disablePastDates,
    { replaceDisabledDateWhenRestricted: true, today },
  );
  const beforeToday = mergeDisabledDateWithRestriction(
    { beforeToday: true },
    disablePastDates,
    { replaceDisabledDateWhenRestricted: true, today },
  );

  assert.equal(withoutRestriction?.(today.clone().subtract(1, "day")), true);
  assert.equal(withoutRestriction?.(today), false);
  assert.equal(beforeToday?.(today.clone().subtract(1, "day")), false);
  assert.equal(beforeToday?.(today), true);
});

test("re-evaluates today for a long-lived disabled-date predicate", () => {
  const originalNow = moment.now;
  const july16 = moment("2026-07-16T12:00:00+04:00").valueOf();
  const july17 = moment("2026-07-17T12:00:00+04:00").valueOf();

  try {
    moment.now = () => july16;
    const disabledDate = mergeDisabledDateWithRestriction({
      tenDaysFromToday: true,
    });

    moment.now = () => july17;

    assert.equal(
      disabledDate?.(moment("2026-07-27", "YYYY-MM-DD", true)),
      true,
    );
  } finally {
    moment.now = originalNow;
  }
});

test("keeps a typed date only when the active restriction disables it", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    { tenDaysFromToday: true },
    undefined,
    { today },
  );

  assert.equal(
    getDisabledDateInputValue("26/07/2026", disabledDate),
    "26/07/2026",
  );
  assert.equal(
    getDisabledDateInputValue("27/07/2026", disabledDate),
    undefined,
  );
  assert.equal(
    getDisabledDateInputValue("not-a-date", disabledDate),
    undefined,
  );
});

test("ignores the ten-day rule when the consumer disables it", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    { tenDaysFromToday: true },
    undefined,
    { allowTenDaysFromToday: false, today },
  );

  assert.equal(disabledDate, undefined);
});

test("merges the ten-day rule with an existing disabled-date predicate", () => {
  const disabledDate = mergeDisabledDateWithRestriction(
    { tenDaysFromToday: true },
    (current) => current.isSame("2026-07-30", "day"),
    { today },
  );

  assert.equal(
    disabledDate?.(moment("2026-07-27", "YYYY-MM-DD", true)),
    false,
  );
  assert.equal(
    disabledDate?.(moment("2026-07-30", "YYYY-MM-DD", true)),
    true,
  );
});
