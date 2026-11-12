# ATUS time use, 2003-2025 (compact file for VizHub)

File: atus_time_use_2003_2025.csv (9,936 rows). One row = one year x age group x sex x day type x activity.

Source: U.S. Bureau of Labor Statistics, American Time Use Survey 2003-2025 Activity Summary file (atussum_0325). https://www.bls.gov/tus/data/datafiles-0325.htm

Columns
- year: 2003 to 2025
- age_group: 15-24, 25-34, 35-44, 45-54, 55-64, 65+
- sex: Male, Female
- day_type: Weekday or Weekend (the diary day: Sunday and Saturday are Weekend)
- activity: one of 18 activity categories (below)
- activity_group: Sleep and personal care, Work and school, Home and family, Errands and services, Eating and drinking, Leisure and social, Travel, Other
- avg_minutes: average minutes per day on that activity for people in that group on that kind of day
- respondents: number of survey respondents in the group (the same for every activity in that group; smallest is 105)

How it was built
- Each respondent's minutes were summed into 18 categories from the 6-digit activity codes. Every respondent's categories add to 1,440 minutes (24 hours), so the averages in a group add to 24 hours.
- Averages are weighted with the ATUS final weight (TUFNWGTP). 2020 respondents have no standard weight, so their 2020-method weight (TU20FWGT) is used for 2020.
- Checks against BLS published national figures: 2023 average of about 9.1 hours sleeping, 3.3 hours work (all adults, all days), 2.7 hours TV and movies.

Notes
- Averages include people who did none of the activity that day, so "Work" is an average across everyone, not only people who worked.
- 2020 values reflect the pandemic, and data collection was suspended for part of spring 2020.
