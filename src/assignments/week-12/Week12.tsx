import { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';

// Week 12: VizHub prototype, integrated. A dumbbell chart that compares how the
// average American spends a day in two years of the American Time Use Survey.
// Each row is an activity; the dot on the left is the first year, the dot on the
// right is the second year, and the line between them is the change. Pick the
// years, age group, sex and weekday/weekend, and sort by size of change.
// Data: BLS ATUS Activity Summary files, 2003 to 2025, weighted average minutes
// per day (people who did none of an activity count as zero). Notes in README.md.

const URL = `${import.meta.env.BASE_URL}data/atus_time_use_2003_2025.csv`;

interface Row {
  year: number;
  age: string;
  sex: string;
  day: string;
  activity: string;
  group: string;
  mins: number;
  n: number;
}

const INK = '#37424f';
const PAGE = '#e8ebee';
const PANEL = '#fafbfc';
const FROM = '#8a97a6';
const TO = '#3f8f89';
const UP = '#3f8f89';
const DOWN = '#b0583f';
const FONT = "'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif";

const AGES = ['All ages', '15-24', '25-34', '35-44', '45-54', '55-64', '65+'];
type SortKey = 'change' | 'size';

function parse(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const ix = (k: string) => head.indexOf(k);
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    out.push({
      year: +c[ix('year')],
      age: c[ix('age_group')],
      sex: c[ix('sex')],
      day: c[ix('day_type')],
      activity: c[ix('activity')],
      group: c[ix('activity_group')],
      mins: +c[ix('avg_minutes')],
      n: +c[ix('respondents')],
    });
  }
  return out;
}

const hm = (m: number) => {
  const a = Math.abs(Math.round(m));
  return a >= 60 ? `${Math.floor(a / 60)}h ${a % 60}m` : `${a} min`;
};

function Select(props: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 700, gap: 2 }}>
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ font: 'inherit', fontWeight: 600, padding: '5px 8px', borderRadius: 6, border: '1px solid #c5ced6', background: '#fff', color: INK }}
      >
        {props.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Week12() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [a, setA] = useState('2003');
  const [b, setB] = useState('2025');
  const [age, setAge] = useState('All ages');
  const [sex, setSex] = useState('Female');
  const [day, setDay] = useState('Weekday');
  const [sort, setSort] = useState<SortKey>('change');
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
    fetch(URL)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => setRows(parse(t)))
      .catch((e: Error) => setError(e.message));
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const years = useMemo(() => (rows ? [...new Set(rows.map((r) => String(r.year)))].sort() : []), [rows]);

  // Minutes per activity for one year, for the chosen group. "All ages" averages the
  // six age groups weighted by how many people were surveyed in each.
  const minutesFor = useMemo(() => {
    return (year: string) => {
      const m = new Map<string, { w: number; s: number }>();
      if (!rows) return m;
      for (const r of rows) {
        if (String(r.year) !== year || r.sex !== sex || r.day !== day) continue;
        if (age !== 'All ages' && r.age !== age) continue;
        const e = m.get(r.activity) ?? { w: 0, s: 0 };
        e.w += r.n;
        e.s += r.mins * r.n;
        m.set(r.activity, e);
      }
      return m;
    };
  }, [rows, sex, day, age]);

  const data = useMemo(() => {
    const ma = minutesFor(a);
    const mb = minutesFor(b);
    const list = [...ma.keys()]
      .filter((k) => mb.has(k))
      .map((k) => {
        const x = ma.get(k)!;
        const y = mb.get(k)!;
        const va = x.s / x.w;
        const vb = y.s / y.w;
        return { activity: k, va, vb, d: vb - va };
      });
    list.sort((p, q) => (sort === 'change' ? q.d - p.d : Math.max(q.va, q.vb) - Math.max(p.va, p.vb)));
    return list;
  }, [minutesFor, a, b, sort]);

  if (error) return <p style={{ padding: 24 }}>Could not load the time use data: {error}</p>;
  if (!rows) return <p style={{ padding: 24 }}>Loading time use data...</p>;

  // Sleep dwarfs everything, so the x axis uses a square-root scale to keep small
  // activities readable. The axis labels show real minutes.
  const W = 900;
  const LABEL = 250;
  const ROW = 26;
  const TOP = 30;
  const H = TOP + data.length * ROW + 24;
  const maxV = Math.max(...data.map((d) => Math.max(d.va, d.vb)), 1);
  const x = scaleLinear().domain([0, Math.sqrt(maxV)]).range([LABEL, W - 150]);
  const px = (v: number) => x(Math.sqrt(Math.max(v, 0)));
  const ticks = [0, 10, 30, 60, 120, 240, 480].filter((t) => t <= maxV * 1.05);

  const biggestUp = [...data].sort((p, q) => q.d - p.d)[0];
  const biggestDown = [...data].sort((p, q) => p.d - q.d)[0];
  const who = `${age === 'All ages' ? 'people aged 15+' : `ages ${age}`}, ${sex.toLowerCase()}s, ${day.toLowerCase()}s`;

  return (
    <div style={{ background: PAGE, color: INK, fontFamily: FONT, minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>How has the American day changed?</h1>
        <p style={{ margin: '2px 0 12px', fontSize: 14 }}>
          Average minutes per day by activity, {a} vs {b}. American Time Use Survey, BLS.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          <Select label="From year" value={a} options={years} onChange={setA} />
          <Select label="To year" value={b} options={years} onChange={setB} />
          <Select label="Age group" value={age} options={AGES} onChange={setAge} />
          <Select label="Sex" value={sex} options={['Female', 'Male']} onChange={setSex} />
          <Select label="Day type" value={day} options={['Weekday', 'Weekend']} onChange={setDay} />
          <Select label="Sort rows by" value={sort === 'change' ? 'Biggest increase' : 'Most time'} options={['Biggest increase', 'Most time']} onChange={(v) => setSort(v === 'Most time' ? 'size' : 'change')} />
        </div>

        {biggestUp && biggestDown && (
          <p style={{ background: PANEL, borderRadius: 8, padding: '10px 14px', margin: '0 0 12px', fontSize: 14, lineHeight: 1.45 }}>
            For {who}, the biggest rise from {a} to {b} is <b>{biggestUp.activity}</b> ({biggestUp.d >= 0 ? '+' : '-'}{hm(biggestUp.d)} a day) and the biggest drop is <b>{biggestDown.activity}</b> ({biggestDown.d >= 0 ? '+' : '-'}{hm(biggestDown.d)} a day).
          </p>
        )}

        <div style={{ background: PANEL, borderRadius: 8, padding: 8, overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Dumbbell chart of minutes per day by activity in two years">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={px(t)} x2={px(t)} y1={TOP - 8} y2={H - 24} stroke="#d5dbe1" />
                <text x={px(t)} y={H - 8} textAnchor="middle" fontSize={11} fill="#5b6672">
                  {t}
                </text>
              </g>
            ))}
            <text x={W - 8} y={16} textAnchor="end" fontSize={11} fill="#5b6672">
              minutes per day, square-root scale
            </text>
            <circle cx={LABEL} cy={12} r={5} fill={FROM} />
            <text x={LABEL + 10} y={16} fontSize={12} fontWeight={700}>{a}</text>
            <circle cx={LABEL + 70} cy={12} r={5} fill={TO} />
            <text x={LABEL + 80} y={16} fontSize={12} fontWeight={700}>{b}</text>
            {data.map((d, i) => {
              const y = TOP + i * ROW + ROW / 2;
              const on = hover === d.activity;
              return (
                <g key={d.activity} onMouseEnter={() => setHover(d.activity)} onMouseLeave={() => setHover(null)} opacity={hover && !on ? 0.45 : 1}>
                  <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill={on ? '#eef1f4' : 'transparent'} />
                  <text x={LABEL - 12} y={y + 4} textAnchor="end" fontSize={12.5} fontWeight={on ? 800 : 600}>
                    {d.activity}
                  </text>
                  <line x1={px(d.va)} x2={px(d.vb)} y1={y} y2={y} stroke={d.d >= 0 ? UP : DOWN} strokeWidth={3} strokeLinecap="round" />
                  <circle cx={px(d.va)} cy={y} r={5.5} fill={FROM} stroke="#fff" strokeWidth={1.5} />
                  <circle cx={px(d.vb)} cy={y} r={5.5} fill={TO} stroke="#fff" strokeWidth={1.5} />
                  {on && (
                    <text x={Math.max(px(d.va), px(d.vb)) + 12} y={y + 4} fontSize={12} fill={INK} fontWeight={700}>
                      {Math.round(d.va)} to {Math.round(d.vb)} min ({d.d >= 0 ? '+' : '-'}{Math.round(Math.abs(d.d))})
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <p style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.4 }}>
          Green lines mean more time in the later year, rust lines mean less. Averages include people who did none of the activity that day.
          The 2020 survey was disrupted by the pandemic, so compare with care. Hover a row for exact minutes.
        </p>
      </div>
    </div>
  );
}
