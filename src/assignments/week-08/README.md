# Week 8: Iterate the project

Live page: `?example=8`. Two tabs.

**What was wrong.** My 10,000-household sample (Weeks 4 to 7) did not match the FDIC's published results. I traced it back to the FDIC 2023 survey file and found three mistakes in how I built it:

1. I kept only households whose reference person lives with relatives. That left out 11,066 households that answered, including all 9,058 people living alone.
2. I kept 8,221 households that never answered the banking questions. The file gives them a default "fully banked" code.
3. I did not use the survey weights.

Two labels were also swapped: what I called "Online Banking" is mobile banking, and what I called "Mobile Banking App" is online banking.

**Digital participation.** Uses the rebuilt file. Shows the share of households using a payment tool, by banking status and by income, age or education, with approximate 95% ranges.

## Rebuilt data

`public/data/digital-payments/households_2023.csv`: 29,483 rows, one per household that answered the FDIC banking supplement, 29 columns, with the household weight (the file stores it multiplied by 10,000; I divided by 10,000, and it sums to 133.7 million households).

I checked the output against 37 figures the FDIC publishes (banking status, mobile / in-person / off-site access, online payment services, prepaid cards, money orders, check cashing, money transfers, disability, household type, education, reasons for being unbanked). All 37 match within rounding. Black and Hispanic unbanked rates are close (10.2 vs 10.6, 9.4 vs 9.5) but not exact, likely a difference in how the groups are defined.

## Caveats

- Ranges are approximate: they use the weights but ignore the survey's clustering, so the true ranges are somewhat wider.
- Some codes could not be checked against published numbers (teller vs ATM split, some race codes, the "behind on bills" question, other reasons for being unbanked). They are not used in the charts, or only as totals.
- The 2023 file has one year and no cash-payment questions, so it cannot show how payments changed over time. That needs earlier FDIC survey years and another source for cash vs card shares.

## Sources

FDIC, 2023 National Survey of Unbanked and Underbanked Households (executive summary, technical notes, and the household analysis file).
