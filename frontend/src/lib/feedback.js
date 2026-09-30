// EM Fitness: an athlete's discomfort or pain report on one exercise of a workout (entry.fb),
// for the trainer: { lvl: 'discomfort' | 'pain', zone?, note?, at }.
import { t } from './i18n.js'

export const ZONES = ['Neck', 'Shoulder', 'Elbow', 'Wrist', 'Upper back', 'Lower back', 'Hip', 'Knee', 'Ankle', 'Other']
export const FB_LEVELS = [['', 'No discomfort'], ['discomfort', 'Discomfort'], ['pain', 'Pain']]

/** "Pain · Shoulder" in the current language; '' when there is no report. */
export const fbLabel = fb => fb
  ? [t(FB_LEVELS.find(l => l[0] === fb.lvl)?.[1] || 'Discomfort'), fb.zone ? t(fb.zone) : null].filter(Boolean).join(' · ')
  : ''
