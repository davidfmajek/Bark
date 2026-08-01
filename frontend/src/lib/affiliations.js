/** UMBC affiliation choices — must match `affiliation_enum` in supabase/schema.sql */

export const AFFILIATION_OPTIONS = [
  { value: 'Student', label: 'Student' },
  { value: 'Professor', label: 'Professor' },
  { value: 'Staff', label: 'Staff' },
  { value: 'Alumni', label: 'Alumni' },
  { value: 'Graduate Student', label: 'Graduate Student' },
  { value: 'Other', label: 'Other' },
];
export const TICKET_REASONS = [
  { value: 'account_issue', label: 'Account Issue' },
  { value: 'technical_bug', label: 'Technical Bug' },
  { value: 'feature_suggestion', label: 'Feature Suggestion' },
  { value: 'outdated_info', label: 'Outdated Restaurant Info' },
  { value: 'other', label: 'Other' },
];
function normalizeAffiliationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

const AFFILIATION_BY_KEY = AFFILIATION_OPTIONS.reduce((acc, option) => {
  acc[normalizeAffiliationKey(option.value)] = option.value;
  return acc;
}, {});

export function toAffiliationOptionValue(value) {
  const key = normalizeAffiliationKey(value);
  if (!key) return '';
  return AFFILIATION_BY_KEY[key] || String(value).trim();
}

export function getAffiliationWriteCandidates(value) {
  const canonical = toAffiliationOptionValue(value);
  if (!canonical) return [''];
  return [canonical];
}

