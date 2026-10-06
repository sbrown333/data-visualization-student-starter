import type { ComponentType } from 'react';
import { ResponsivePseudoScatterPlot } from './week-01/ResponsivePseudoScatterPlot';
import { DigitalPaymentsSummary } from './week-02/DigitalPaymentsSummary';
import { FirstVisual } from './week-03/FirstVisual';
import { SecondPassVisual } from './week-04/SecondPassVisual';
import { InteractiveVisual } from './week-05/InteractiveVisual';
import { Week6 } from './week-06/Week6';
import { Week7 } from './week-07/Week7';

export interface Assignment {
  id: string;
  name: string;
  component: ComponentType;
}

export const assignments: Assignment[] = [
  {
    id: '1',
    name: 'Week 1',
    component: ResponsivePseudoScatterPlot,
  },
  {
    id: '2',
    name: 'Week 2',
    component: DigitalPaymentsSummary,
  },
  {
    id: '3',
    name: 'Week 3',
    component: FirstVisual,
  },
  {
    id: '4',
    name: 'Week 4',
    component: SecondPassVisual,
  },
  {
    id: '5',
    name: 'Week 5',
    component: InteractiveVisual,
  },
  {
    id: '6',
    name: 'Week 6',
    component: Week6,
  },
  {
    id: '7',
    name: 'Week 7',
    component: Week7,
  },
];

export const assignmentsMap = new Map(assignments.map((ex) => [ex.id, ex]));

export const defaultAssignment = '1';
