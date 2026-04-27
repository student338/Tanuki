/**
 * Reading level constants shared between server-side storage logic and
 * client-side components.  This file must NOT import any Node-only modules
 * (e.g. `fs`, `path`) so it remains safe to use in browser bundles.
 */

export type ReadingLevel =
  | 'Pre-K'
  | 'Kindergarten'
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'College'
  | 'Graduate'
  | 'Doctorate';

export const READING_LEVEL_VALUES: ReadingLevel[] = [
  'Pre-K',
  'Kindergarten',
  'Elementary',
  'Middle School',
  'High School',
  'College',
  'Graduate',
  'Doctorate',
];
