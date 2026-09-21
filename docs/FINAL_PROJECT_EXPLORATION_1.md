Project Proposal: The Transformation of Payments in America

Topic Consumers, businesses, and financial institutions are increasingly moving toward digital payments, but the pace of this transition is not equal across age groups, income levels, and types of consumers. This project explores who may be underserved or excluded as the U.S. becomes increasingly cashless, looking at banking access, digital payment adoption, and the demographic factors (age, income, education, employment) that shape them.

Questions to Investigate How does banking status (unbanked / underbanked / fully banked) vary across age groups, income brackets, and education levels? How do people primarily access their bank accounts (in-person teller, ATM, phone, online, mobile app), and how does that mix shift across demographics? Are there geographic patterns: do certain states or regions have higher rates of unbanked/underbanked households? Does housing tenure (owning vs. renting) or employment status correlate with banking access? Has the primary method of accessing a bank account shifted over time as mobile and online banking have become more common? Among underbanked households, which alternative financial services (prepaid cards, nonbank payment apps) are most common, and does that vary by group?

Potential Datasets FDIC National Survey of Unbanked and Underbanked Households: the primary dataset for this project. A biennial, nationally representative survey (run with the Census Bureau as a CPS supplement) covering banking status, account access methods, and demographics. Already downloaded and trimmed a 2023 sample (10,000 households, 15 columns) for the Week 2 assignment. Federal Reserve Diary of Consumer Payment Choice (DCPC): individual-level survey data on which payment methods (cash, debit, credit, mobile) people use for specific transactions, with demographic breakdowns. Richer on payment method detail than the FDIC survey, though heavier to clean. FDIC "Where Are the Underbanked Areas?" Data Tool (Boston Fed): state/metro-level aggregated data, useful if the project takes a geographic angle.

Related Work / Inspiration Charted: America's Shift to a Cashless Society (Visual Capitalist): uses Federal Reserve DCPC data to chart the declining share of cash transactions over time. Good reference for a simple, readable trend line. Where Are the Underbanked Areas? Data Tool (Federal Reserve Bank of Boston): an interactive map/dashboard letting users explore unbanked/underbanked rates by location. Strong reference for a geographic visualization approach. A Closer Look at the Unbanked: Cash-Only Households (FDIC Consumer Research Perspectives): a short research brief with simple charts breaking down unbanked households by whether they use prepaid cards or payment apps. Good model for a focused, single-question visualization. 2023 FDIC National Survey Report: the source report itself, includes the official charts and tables the survey data is built from.

Sketches All four sketches below were drawn on a single page. 
<img width="3024" height="3518" alt="Image" src="https://github.com/user-attachments/assets/efccfdf1-a31d-4ab0-bef0-9d3a0cf76872" />

Sketch 1: Geographic Map A rough outline representing the U.S., with circles placed inside it. Circle size represents the unbanked rate in that area: a bigger circle means a higher share of unbanked households. The idea is to see at a glance which regions have the most financial exclusion, without needing exact state boundaries yet.

Sketch 2: Stacked Bar by Age Four bars, one per age group (18-24, 35-44, 55-64, 65+), each split into segments for unbanked, underbanked, and fully banked. The bottom segments (unbanked/underbanked) get visibly smaller from left to right, showing the trend that younger households are less likely to be fully banked.

Sketch 3: Small Multiples Grid Four small bar-chart panels, each representing a different demographic slice (low income, mid income, no degree, has degree). Each mini-chart shows the same three categories so they can be compared side by side, making it easy to see which factor, income or education, has a bigger effect on banking status.

Sketch 4: Access Method Flow Boxes for "Teller," "ATM," "Online," and "Mobile," with arrows showing how people might move between account access methods. The idea is to visualize a shift over time or across groups: for example, older users concentrated near Teller/ATM, younger users near Online/Mobile.




## Task Analysis

**Who this is for:** people trying to understand financial inclusion in America, policymakers, researchers, financial literacy advocates, or curious members of the public wondering how evenly the shift to digital payments is playing out.

**High-level goal:** understand who is being left behind as banking and payments become more digital, and why.

### Tasks

- **Compare** banking status (unbanked, underbanked, fully banked) across different population segments, such as age groups, income brackets, and education levels, to see which factors are associated with the largest gaps.
- **Identify** which demographic groups have the highest rates of exclusion from mainstream banking, so that attention or resources could be targeted appropriately.
- **Rank** demographic segments (for example, age brackets or income brackets) by their unbanked or underbanked rate, to surface the groups furthest from full financial inclusion.
- **Correlate** a household's primary method of accessing their bank account (teller, ATM, phone, online, mobile app) with their demographic profile, to understand whether older or lower-income households are systematically relying on less convenient or less modern access methods.
- **Locate** any geographic concentration of unbanked or underbanked households, to determine whether financial exclusion is a nationwide pattern or concentrated in particular states or regions.
- **Summarize** the overall shape of the population: what proportion of households fall into each banking status category, and what the general demographic makeup looks like.
- **Browse/Explore** the dataset at the level of individual demographic combinations (for example, low income and no degree vs. high income and a degree), to generate hypotheses about which combinations of factors compound financial exclusion.
- **Determine associations** between housing tenure (owning vs. renting) or employment status and banking access, to understand whether financial exclusion is tied to broader economic stability.

These tasks are independent of any particular chart type. For instance, the "compare across demographic groups" task could be satisfied by a small multiples grid, a grouped bar chart, or a stacked bar chart; the "locate geographic concentration" task could be satisfied by a choropleth map or a ranked list of states. The sketches from last week represent early, chart-type-specific explorations of how some of these tasks might be visually addressed; the final design should be chosen based on which chart types best serve the tasks above, not the other way around.





Validation
Applying the four levels of the Nested Model (Munzner, Ch. 4) to this project, using an imagined ideal user: a researcher or financial literacy advocate at a nonprofit or government agency who wants to understand and communicate which populations are being left behind as banking and payments go digital.

Domain Situation
Claim: Financial literacy advocates and policymakers currently rely on static PDF reports (like the FDIC's own survey report) to understand unbanked/underbanked trends, and lack an easy way to explore how banking status varies across intersecting demographic factors (age, income, education, employment) on their own.
Validation approach: Ideally, this would be validated by observing and interviewing target users, watching how a financial literacy advocate currently digs through FDIC PDF reports or spreadsheets to answer questions like "which age group needs outreach most," and noting where that process breaks down. Since there is no real user for this class project, this is a hypothesized domain situation based on the fact that the source data itself is only published as static tables and PDF reports, with no interactive exploration tool aside from the Boston Fed's more limited state-level map.

Data/Task Abstraction
Claim: The right data abstraction is the household-level survey sample already assembled (demographics + banking status + access method), and the right task abstraction is the set of tasks written up in the Task Analysis section above: compare, identify, rank, correlate, locate, summarize, and browse/explore.
Validation approach: This is validated by checking that the tasks were derived independently of any chart type (as required by the Task Analysis assignment) and that they trace back to the domain situation. In an ideal setting, this abstraction would be validated by walking through the task list with a real financial literacy advocate and confirming that these are actually the questions they'd want answered. Since that's not available here, the check is against the source material: every task maps to a question genuinely raised in the FDIC's own published analysis (age, income, education, and geography are exactly the breakdowns the FDIC itself reports on), which is a weaker but still meaningful proxy for domain validity.

Visual Encoding / Interaction Idiom
Claim: A combination of small multiples, a stacked/grouped bar chart, and a simple map or ranked list will support the comparison, ranking, and geographic tasks better than a single, dense chart trying to show everything at once.
Validation approach: The correct method here is to justify the design with respect to alternatives, which is exactly why last week's sketches explored four different idiom options (map, stacked bar, small multiples, flow diagram) instead of committing to one immediately. Going forward, this would ideally also involve informal usability testing: showing a working prototype to a few people and watching whether they can complete a task like "find which age group has the highest unbanked rate" without guidance. A computational benchmark showing the chart renders quickly would NOT be sufficient evidence here, per the "avoid mismatches" principle. Fast rendering validates the algorithm, not whether the encoding communicates the right thing.

Algorithm
Claim: The dataset (10,000 rows, 15 columns, under 2MB) can be loaded, parsed, and rendered in the browser with no noticeable lag, and any future filtering/interaction (such as selecting a demographic subgroup) should update the visualization in well under a second.
Validation approach: This is validated by direct measurement (system time), the standard computer science method for the algorithm layer. In practice, this was already informally checked: the Week 2 and Week 3 implementations load and parse the CSV client-side without a visible delay, and a formal check going forward would time how long parsing and re-rendering take as interactive filters are added, to make sure the experience stays responsive as the project grows more interactive.




## Progress Since Initial Proposal

Since the original proposal, the project has moved from sketches to a working, iteratively improved chart built on the real FDIC dataset:

- **Week 2** loaded and summarized the trimmed 10,000-household sample, confirming the dataset was usable end to end in the browser.
- **Week 3** produced a first real visual: a bar chart of banking status counts across the full sample.
- **Week 4** focused on legibility: added a title, subtitle, axis labels, gridlines, and value/percent labels so the chart could stand on its own without explanation.
- **Week 5** added two forms of interaction: hovering a bar now shows a tooltip defining that banking status category with its count and percentage, and a clickable color legend lets a viewer show or hide categories, with the chart rescaling to whatever is visible.

<img width="1200" alt="Week 2 summary" src="https://github.com/user-attachments/assets/ae6be5bf-7c1e-4c2c-9603-02f5dc1e0518">

<img width="1200" alt="Week 3 first visual" src="https://github.com/user-attachments/assets/8a57919e-2c6b-42a6-96aa-1f3be9bce7d7">

<img width="1200" alt="Week 4 legibility pass" src="https://github.com/user-attachments/assets/dedc1a63-a86e-458c-aa04-de2c801acb0f">

<img width="1200" alt="Week 5 interaction" src="https://github.com/user-attachments/assets/98c81313-cb2d-433b-bf28-8e9778dd7334">

This progression validates the "Algorithm" claim from the Validation section: the dataset loads and re-renders with no noticeable lag, even as filtering and hover interaction were added on top of the base chart.

## North Star Sketch

The sketches from Week 1 explored four separate chart-type ideas in isolation. This sketch imagines them combined into one interactive dashboard, the most ambitious version of this project I'd want to reach by the end of the course, even if the final build ends up covering only part of it.

<img width="1400" alt="North star dashboard concept" src="https://github.com/user-attachments/assets/fc91e628-e048-42d9-81e3-7f3fcd6ea749">

**The concept:** a single-page dashboard called *"Left Behind? Mapping America's Digital Payments Divide."* Five pieces work together instead of as separate charts:

1. **A hex-grid state map** (left) where each state is sized and colored by its combined unbanked-plus-underbanked rate, replacing Sketch 1's rough circle-on-outline idea with something clickable.
2. **A small-multiples row** (top right) comparing the same three-category breakdown across income, education, age, and employment side by side, directly extending Sketch 3.
3. **A filter and legend panel** (right) where clicking a legend swatch or an age chip filters every other panel on the page at once, not just the one chart it's attached to.
4. **An access-method flow diagram** (bottom of that panel), evolving Sketch 4's Teller-ATM-Online-Mobile boxes into something that would highlight the live-selected filter's path.
5. **A trend line over time** (bottom), showing 2009-2023 survey years so a viewer can see not just where exclusion is concentrated today, but whether the gap between groups is closing or widening.

The unifying idea, and the actual "north star," is that clicking anything (a state, a legend swatch, an age chip, a point on the timeline) refilters every other panel together, so one question, "who's still left behind, and by how much," can be answered from five angles without leaving the page.

**Stretch idea:** if there's time, an AI-generated companion illustration (a more editorial, magazine-style visual rather than a dashboard mockup) could accompany the project as a cover image: a stylized scene contrasting a brightly-lit, connected digital neighborhood with a dimmer, disconnected one nearby, still linked by the same street, visually representing the "who's left behind" theme rather than the data itself.
