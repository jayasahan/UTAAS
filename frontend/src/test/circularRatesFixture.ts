import type { CircularRates } from '../auth/contracts';

// Test-only snapshot of getApprovedRates() at origin/mvp 019879b.
// These numbers are never imported as runtime policy or a fallback.
export const currentCircularFixture: CircularRates = {
  circularReference: 'UGC Commission Circulars No. 981, 681, 636',
  rates: {
    PAPER_SETTING: {
      label: 'Setting (3 Hr Paper)',
      unit: 'per paper',
      rate: 1200,
    },
    PAPER_MODERATION: { label: 'Moderation', unit: 'per paper', rate: 1200 },
    PAPER_TYPING: {
      label: 'Typing',
      unit: 'per page (max Rs. 500/paper)',
      rate: 100,
    },
    SCRIPT_MARKING: {
      label: 'Degree script marking',
      unit: 'per script',
      rate: 100,
    },
    CONTINUOUS_ASSESSMENT: {
      label: 'Continuous assessment',
      unit: 'per student / assessment',
      rate: 25,
    },
    PRACTICAL_ASSESSMENT: {
      label: 'Practical assessment',
      unit: 'per script / candidate',
      rate: 100,
    },
    SECOND_MARKING: { label: 'Second marking', unit: 'per script', rate: 100 },
    DISSERTATION_UNDERGRAD: {
      label: 'Undergraduate dissertation',
      unit: 'per dissertation',
      rate: 600,
    },
    DISSERTATION_POSTGRAD: {
      label: 'Postgraduate dissertation',
      unit: 'per dissertation',
      rate: 2000,
    },
    THESIS_MPHIL: { label: 'M.Phil. thesis', unit: 'per thesis', rate: 3000 },
    THESIS_PHD: { label: 'Ph.D. thesis', unit: 'per thesis', rate: 5000 },
    PAPER_TRANSLATION: {
      label: 'Translation (N/A for Engineering)',
      unit: 'per paper',
      rate: 0,
    },
  },
};
