# Overtime Calculation Flow Diagram

## Overview
This diagram shows how overtime is calculated and integrated into the payroll and invoicing system.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEEKLY WORK DATA INPUT                           │
├─────────────────────────────────────────────────────────────────────┤
│  • Total Hours Worked: 50 hours                                     │
│  • Hourly Work: 25 hrs × $19.82/hr = $495.50                       │
│  • Piecework: 10 units × $30/unit = $300.00                        │
│  • Total Raw Earnings: $795.50                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: CALCULATE REST BREAKS                    │
├─────────────────────────────────────────────────────────────────────┤
│  • Piecework Hours: 25 hrs                                          │
│  • Rest Break Formula: floor(25/4) × (10/60) hrs                   │
│  • Rest Break Hours: 1 hour                                        │
│  • Rest Break Rate: $300 / 25 = $12/hr                            │
│  • Rest Break Pay: 1 × $12 = $12.00                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 2: MINIMUM WAGE ADJUSTMENT                  │
├─────────────────────────────────────────────────────────────────────┤
│  • Total Earnings + Breaks: $795.50 + $12.00 = $807.50           │
│  • Calculated Rate: $807.50 / 50 = $16.15/hr                      │
│  • WA Minimum Wage: $19.82/hr                                      │
│  • Rate Check: $16.15 < $19.82 ❌                                  │
│  • Required Pay: 50 × $19.82 = $991.00                            │
│  • Top-Up Amount: $991.00 - $807.50 = $183.50                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 3: OVERTIME CALCULATION                     │
├─────────────────────────────────────────────────────────────────────┤
│  • Adjusted Earnings: $991.00                                       │
│  • Total Hours: 50 hrs                                             │
│  • Overtime Threshold: 40 hrs                                      │
│  • Hours Check: 50 > 40 ✅                                         │
│  • Overtime Hours: 50 - 40 = 10 hrs                               │
│  • Regular Rate: $991 / 50 = $19.82/hr                            │
│  • Overtime Premium Rate: $19.82 × 0.5 = $9.91/hr                 │
│  • Overtime Premium: $9.91 × 10 = $99.10                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 4: FINAL PAY CALCULATION                    │
├─────────────────────────────────────────────────────────────────────┤
│  • Raw Earnings:           $795.50                                  │
│  • Rest Breaks:            + $12.00                                 │
│  • Min Wage Top-Up:        + $183.50                                │
│  • Overtime Premium:       + $99.10                                 │
│  ├─────────────────────────────────────────────────────────────────┤
│  • TOTAL PAY:              $1,090.10 ✅                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│   PAYROLL REPORT        │   │   INVOICE REPORT        │
├─────────────────────────┤   ├─────────────────────────┤
│ Weekly Summary:         │   │ Cost Breakdown:         │
│ • Total Hours: 50.00    │   │ • Labor Cost: $795.50   │
│ • Raw Earnings: $795.50 │   │ • Rest Breaks: $12.00   │
│ • Rest Breaks: $12.00   │   │ • Min Wage Adj: $183.50 │
│ • Min Wage: $183.50     │   │ • Overtime: $99.10      │
│ • Overtime Hrs: 10.00   │   │ ├─────────────────────  │
│ • Regular Rate: $19.82  │   │ • Subtotal: $1,090.10   │
│ • OT Premium: $99.10    │   │ • Commission: $54.51    │
│ ├─────────────────────  │   │ ├─────────────────────  │
│ • Final Pay: $1,090.10  │   │ • TOTAL: $1,144.61      │
└─────────────────────────┘   └─────────────────────────┘
```

## Key Calculation Formulas

### Rest Breaks (Piecework Only)
```
rest_break_hours = floor(piecework_hours / 4) × (10 / 60)
rest_break_pay = rest_break_hours × piecework_rate
```

### Minimum Wage Adjustment
```
calculated_rate = (raw_earnings + rest_breaks) / total_hours
if calculated_rate < minimum_wage:
    required_pay = total_hours × minimum_wage
    top_up = required_pay - (raw_earnings + rest_breaks)
else:
    top_up = 0
```

### Overtime Calculation
```
if total_hours > 40:
    overtime_hours = total_hours - 40
    adjusted_earnings = raw_earnings + rest_breaks + top_up
    regular_rate = adjusted_earnings / total_hours
    regular_rate = max(regular_rate, minimum_wage)
    overtime_premium = (regular_rate × 0.5) × overtime_hours
else:
    overtime_premium = 0
```

### Final Pay
```
final_pay = raw_earnings + rest_breaks + top_up + overtime_premium
```

## Example Scenarios Comparison

```
┌──────────────┬─────────┬────────────┬─────────┬──────────┬───────────┐
│   Scenario   │  Hours  │    Raw     │ Min Wage│ Overtime │   Total   │
│              │         │  Earnings  │ Top-Up  │ Premium  │    Pay    │
├──────────────┼─────────┼────────────┼─────────┼──────────┼───────────┤
│ 1. High Piece│   50    │  $1,200.00 │  $0.00  │ $120.00  │ $1,320.00 │
│ 2. Low Piece │   50    │    $800.00 │$191.00  │  $99.10  │ $1,090.10 │
│ 3. High Mixed│   50    │  $1,035.50 │  $0.00  │ $103.55  │ $1,139.05 │
│ 4. Low Mixed │   50    │    $795.50 │$195.50  │  $99.10  │ $1,090.10 │
└──────────────┴─────────┴────────────┴─────────┴──────────┴───────────┘
```

## Code Flow

```typescript
// 1. Collect weekly work data
const weeklyHourlyEarnings = calculateHourlyEarnings();
const weeklyPieceworkEarnings = calculatePieceworkEarnings();
const weeklyTotalHours = hourlyHours + pieceworkHours;

// 2. Calculate rest breaks (piecework only)
const restBreaksPay = calculateRestBreaks(pieceworkHours, pieceworkRate);

// 3. Apply minimum wage adjustment
const totalBeforeAdjustment = weeklyHourlyEarnings + 
                              weeklyPieceworkEarnings + 
                              restBreaksPay;
const minimumWageTopUp = calculateMinimumWageTopUp(
  totalBeforeAdjustment,
  weeklyTotalHours,
  applicableMinWage
);

// 4. Calculate overtime
const totalForOvertimeCalc = totalBeforeAdjustment + minimumWageTopUp;
const { overtimeHours, overtimePremium, regularRate } = calculateOvertimePay(
  weeklyTotalHours,
  totalForOvertimeCalc,
  applicableMinWage
);

// 5. Calculate final pay
const finalPay = totalForOvertimeCalc + overtimePremium;
```

## UI Display

### Payroll Report (Weekly Summary)
```
┌────────────────────────────────────────────────────┐
│ Week 45, 2025                                      │
├────────────────────────────────────────────────────┤
│ Total Hours Worked           50.00                 │
│ Raw Task Earnings            $795.50               │
│ Minimum Wage Top-Up          + $183.50 🟡          │
│ Paid Rest Breaks             + $12.00  🔵          │
│                                                    │
│ Overtime Hours (over 40)     10.00 hrs 🟣          │
│ Regular Rate for OT          $19.82/hr 🟣          │
│ Overtime Premium (0.5x)      + $99.10  🟣          │
├────────────────────────────────────────────────────┤
│ Total Weekly Pay             $1,090.10             │
└────────────────────────────────────────────────────┘
```

### Invoice Report (Cost Breakdown)
```
┌────────────────────────────────────────────────────┐
│ Total Base Labor Cost         $795.50              │
│ Paid Rest Breaks              $12.00               │
│ Minimum Wage Adjustments      $183.50              │
│ Overtime Premium              $99.10   🆕          │
├────────────────────────────────────────────────────┤
│ Subtotal                      $1,090.10            │
│ Commission (5%)               $54.51               │
├────────────────────────────────────────────────────┤
│ Total Due                     $1,144.61            │
└────────────────────────────────────────────────────┘
```

---

**Legend:**
- 🟡 Yellow: Minimum wage adjustments
- 🔵 Blue: Rest breaks
- 🟣 Purple: Overtime (NEW)
- 🆕 New feature added
