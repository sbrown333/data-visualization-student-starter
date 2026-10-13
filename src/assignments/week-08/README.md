# Week 8: Iterate the project

**Hosted page:** https://sbrown333.github.io/data-visualization-student-starter/?example=8

## What this is

The project, "Left Behind? Mapping America's Digital Payments Divide", rebuilt on the full 2023 FDIC household file: 29,483 households and 29 columns (the earlier sample had 10,000 and 15). Every rate on the page is weighted with the FDIC household weight, so it represents all U.S. households. Five tabs, one at a time, as in Week 6.

1. **Adoption gap.** Dot plot with approximate 95% range lines: the share of households using a payment tool, by banking status, grouped by income, age, education, employment or home ownership. Click a banking status in the legend to hide it (Week 5).
2. **Readiness explorer.** A heatmap of the Digital Payment Readiness Score by age and income. Drag a box to select cells (linked brushing, Week 7) and the score curve and a dumbbell chart of each component compare the selection with all households. Preset buttons, clear button, table view, and a warning when a selection is small.
3. **Distributions.** Ridgeline plot of the score by group, and one line per group across the score's components.
4. **By state.** A choropleth map (Week 6) of the score, unbanked rate and other measures, linked to a scatterplot of each state's unbanked rate against its online payment use. States above the national unbanked rate and below the national online payment rate are highlighted.
5. **Tool heatmap.** Share of households using each payment tool, by group, with a banking-status filter.

## Digital Payment Readiness Score

My own index, not an official measure. Each household gets 0 to 100: the average of the components that are switched on, each scored 0 to 1.

| Component | Scoring |
|---|---|
| Banking access | fully banked 1, underbanked 0.5, unbanked 0 |
| Smartphone | household has a smartphone |
| Online payments | used nonbank online payment services in the past year |
| Credit card | used a credit card in the past year |
| Digital banking | mainly uses mobile or online banking; unbanked count as 0; banked households that did not answer are left out of this component |
| Income | rank of the household's income among the 16 FDIC income brackets |

Components can be switched on and off, and every view that uses the score redraws. Cash dependence and internet access would belong in an index like this, but the 2023 file has no question on them, so cash dependence is shown greyed out and smartphone stands in for access to the internet.

## Data

`public/data/digital-payments/households_2023.csv`: one row per household that answered the FDIC banking supplement. Built from the FDIC 2023 analysis file; the weight column is the FDIC household weight divided by 10,000 (it sums to 133.7 million households). I checked the file against 37 figures the FDIC publishes (banking status, mobile, in-person and off-site banking, online payment services, prepaid cards, money orders, check cashing, money transfers, disability, household type, education, reasons for being unbanked). All match within rounding. The Black and Hispanic unbanked rates are close (10.2 vs 10.6, 9.4 vs 9.5) but not exact.

## Caveats

- The 2023 file is a single year, so the page shows who uses digital tools in 2023, not how that changed over time. Earlier survey years are needed for that.
- Ranges are approximate: they use the weights but ignore the survey's clustering, so the true ranges are somewhat wider.
- Dashed or hollow marks have fewer than 30 surveyed households. Every state has at least 250.
- The smartphone question and the "behind on bills" question were not checked against a published figure. The smartphone question is used as a score component.
- In the ridgeline plot, very tall peaks (many households scoring exactly 100) are cut off so the other curves stay visible.

## Sources

FDIC, 2023 National Survey of Unbanked and Underbanked Households (executive summary, technical notes and household analysis file): https://www.fdic.gov/household-survey
