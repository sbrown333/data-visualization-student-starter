# Week 13: Over time, and fixes from outside feedback

Builds on the Week 11 dashboard (left as it was). Same data and filters, plus an over-time view and changes from user testing.

**New: over time, 2009 to 2023.** A toggle above the map switches to a line chart across the eight FDIC surveys. Pick a measure (unbanked rate, mainly mobile app, mainly online banking, mainly teller or ATM, smartphone) and how to compare (income, age, education, employment, home ownership, region, or states clicked on the map). The group picked in the dashboard filters is drawn thicker. Data: `public/data/digital-payments/trends_2009_2023.csv`, built from the FDIC multi-year household file with the household weight. Ranges are Wilson 95% intervals using the Kish effective sample size.

**Findings.** The unbanked rate fell from 7.6% in 2009 to 4.2% in 2023, but households under $15k are still about five times the national rate. The share of banked households mainly using a mobile app rose from 5.5% in 2013 to 48.3% in 2023, and the age gap is large: 77% for ages 15 to 24 against 19% for 65 and older in 2023.

**Changes from user testing (feedback from Dorcas Brown).** Plain-language definitions under the summary. A clearer "How to read" box. State labels on the map plus a list of picked states. The heatmap now says "too few" in gray cells and explains them. "Start here" buttons for common views, and a headline sentence that updates with the filters.

**Limits.** The over-time chart shows one comparison at a time and is not narrowed by the other filters. Underbanked is left out because its definition changed between surveys. Smartphone was not asked in 2021. Survey wording and sampling changed a little over the years.
