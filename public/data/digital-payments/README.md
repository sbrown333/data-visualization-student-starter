# Dataset: 2023 FDIC Household Banking Survey (10,000-Household Sample, 15 Columns)

**Source:** [FDIC Household Survey — Data Downloads and Resources](https://www.fdic.gov/household-survey/data-downloads-and-resources)
File used: `hh2023_analys.csv` (2023 Yearly Analysis Dataset), filtered to household reference persons, randomly sampled to 10,000 rows, and decoded into plain-English values.

## Concept

This dataset comes from the FDIC's biennial national survey (conducted with the U.S. Census Bureau as a supplement to the Current Population Survey), which measures how American households access banking and payment services. Each row is one household, describing the reference person's demographics and socioeconomic situation, along with the household's banking status and how they primarily access their bank account. This supports the project's theme of understanding who is being left behind as payments in America shift toward digital and cashless methods — beyond just age and income, factors like education, employment, and housing stability often shape access to mainstream financial tools.

The original file contained 1,668 columns and 69,485 person-level rows (~309 MB). It was filtered to one row per household (26,638 households), randomly sampled down to 10,000 rows, and 15 relevant columns were kept and decoded from numeric survey codes into readable labels.

## Attribute Analysis

| Column | Description | Type |
|---|---|---|
| `age` | Age of the household reference person | Quantitative |
| `age_group` | Age bracket (18-24, 25-34, ..., 65+) | Ordinal |
| `sex` | Male or Female | Categorical |
| `race` | White, Black, American Indian/Alaska Native, Asian, Native Hawaiian/Pacific Islander, or Multi-race/Other | Categorical |
| `hispanic_origin` | Hispanic or Non-Hispanic | Categorical |
| `state` | U.S. state (two-letter abbreviation) | Special case: Geo ID |
| `education_level` | Highest level of education completed (16 ordered levels) | Ordinal |
| `household_size` | Number of people living in the household | Quantitative |
| `employment_status` | Employed, unemployed (looking/on layoff), or not in labor force (retired/disabled/other) | Categorical |
| `marital_status` | Married, separated, divorced, widowed, or never married | Categorical |
| `housing_tenure` | Owns home, rents home, or occupies without cash rent | Categorical |
| `income_bracket` | Household family income range (16 ordered brackets, e.g. "$40k-$50k") | Ordinal |
| `has_bank_account` | Whether the household has a checking/savings account (Yes/No/N/A) | Categorical |
| `banking_status` | Unbanked, Underbanked, or Fully Banked | Categorical |
| `primary_access_method` | How the household primarily accesses its account (Bank Teller, ATM/Kiosk, Telephone Banking, Online Banking, Mobile Banking App, Other, or N/A if unbanked) | Categorical |

**Note:** Category labels follow the standard FDIC/Census CPS coding scheme, as documented in the FDIC's data dictionary. Since this project trims and re-labels the raw codes, it's worth a quick comparison against the `metadata` folder in the original download to confirm nothing shifted for the 2023 survey year — particularly for `education_level` and `marital_status`, which use longer standardized code lists.
