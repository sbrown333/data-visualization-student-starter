import type { ComponentType } from 'react';
import { ResponsivePseudoScatterPlot } from './week-01/ResponsivePseudoScatterPlot';
import { DigitalPaymentsSummary } from './week-02/DigitalPaymentsSummary';

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
];

export const assignmentsMap = new Map(assignments.map((ex) => [ex.id, ex]));

export const defaultAssignment = '1';
