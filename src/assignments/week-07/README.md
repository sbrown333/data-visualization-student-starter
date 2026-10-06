# Week 7: Linked Brushing

**Hosted page:** https://sbrown333.github.io/data-visualization-student-starter/?example=7

## What this is

The page has two tabs. Both use the same technique, linked brushing, from Allison Horst's article on the Observable blog: you drag a box on one chart, and a second chart updates to show only the records you selected.

1. **Banking households** applies the technique to this project's data. It is an adaptation, not a copy of the article's chart.
2. **Penguins (original)** is a close recreation of the article's first example.

## Original piece

- Allison Horst, "Use linked brushing to explore patterns across dimensions, space, and time," Observable blog, January 28, 2025. https://observablehq.com/blog/linked-brushing (the opening "basic example of linked brushing": a penguin scatterplot with a histogram below it)

## Tab 1: Banking households (my adaptation)

The banking survey sample has only two numeric columns, `age` and `household_size`, so those become the two axes of the brushable chart. Ten thousand households would be a pile of overlapping dots, so each bubble is one age and household size pair and its area shows how many households share that pair.

- **Drag a box** over the bubbles. Selected bubbles stay blue and the rest fade to gray. The preset buttons ("Under 25", "65 and over", "Households of 5 or more") draw a box for you.
- **The linked chart** is two stacked bars that split households into unbanked, underbanked, and fully banked: one for all 10,000 households and one for the selection. Three tiles under the bars give the exact percentages and how many times higher or lower each is than the overall rate.
- **Why stacked bars instead of the article's histogram:** only 1.9% of households in the sample are unbanked, so a count chart would make that group almost invisible. Showing shares makes the groups comparable.
- **Example:** selecting the 275 households with a reference person under 25 shows 5.5% unbanked (15 households), against 1.9% overall. That is a small group, and the page warns when a selection has fewer than 30 households.
- **Also included:** hover tooltips with counts, a clear button, and a table view.

Data: the same 10,000-household sample used in Weeks 2 to 6, `public/data/digital-payments/banking_sample_10000.csv`. It comes from the 2023 FDIC National Survey of Unbanked and Underbanked Households, as documented in `public/data/digital-payments/README.md`.

- FDIC Household Survey, data downloads: https://www.fdic.gov/household-survey/data-downloads-and-resources

## Tab 2: Penguins (original)

A scatterplot of penguin bill length against bill depth (colored by species) sits above a histogram of body mass. Drag a box on the scatterplot. The selected penguins keep their color and the rest fade to gray. The histogram draws the selected penguins in black on top of the full distribution in gray.

- **Colors:** the original uses blue, orange, and red. I used blue, orange, and aqua, because the red and orange were too close together for some color-blind readers (checked with a palette validator).
- **Added:** a hover tooltip on the histogram, a clear button, a count of selected penguins, and a table view.
- **Left out:** the NYC taxi and mortgage rate examples from the same article.
- **Data:** 342 of the 344 penguins in the file are plotted. Two have no measurements.
- **Matched by eye:** I could not find the source code for the article's first chart, so the bin width (100 g), axis ranges, and layout were matched from the screenshot in the article.

## Sources and credits

- **Article above** for the design: a brushable chart on top, a linked chart below, selected records highlighted, the rest gray.
- **Brushing approach:** Mike Bostock, "Brushable scatterplot matrix," Observable (D3 collection). https://observablehq.com/@d3/brushable-scatterplot-matrix. The article links to this notebook as its penguin example. I read its source to see how a brush rectangle becomes a selection (compare each point's position to the box). No code was copied. Both tabs here are written from scratch for React and TypeScript.
- **d3-brush documentation:** https://d3js.org/d3-brush
- **Penguin data:** palmerpenguins by Allison Horst, Alison Hill, and Kristen Gorman. https://github.com/allisonhorst/palmerpenguins. The file used is https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv. The data is released under the CC0 license, as stated in that repository's README. The underlying observations are from Gorman, Williams, and Fraser (2014), PLoS ONE, Palmer Station Antarctica LTER.
- **Banking data:** FDIC link above.

## How it is built

- React, TypeScript, and D3 in the course's starter repo.
- `d3-scale` and `d3-array` handle the scales and bins. `d3-brush` handles only the drag box. React draws the dots, bubbles, bars, and axes.
- A selection is a set of row groups kept in React state, and both charts read from it, which is what links them.
- The penguin CSV is bundled into the page at build time. The banking CSV is fetched, like in earlier weeks, and the page shows an error message if that file cannot be loaded.

Files in this folder:

- `Week7.tsx`: the page and its two tabs
- `BankingBrushing.tsx`: the banking chart
- `PenguinBrushing.tsx`: the penguin chart
- `penguins.csv`: the penguin data
- `README.md`: this file

## AI assistance

Built with Claude as the coding agent, using the sources above as reference.
