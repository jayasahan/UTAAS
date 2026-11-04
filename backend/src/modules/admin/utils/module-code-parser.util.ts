export interface ParsedModuleCode {
  prefix: string;
  semester: number;
  credits: number;
  moduleNumber: string;
}

/**
 * Parses Ruhuna Engineering course module code according to standard curriculum nomenclature:
 * E.g., 'IS5302' -> prefix: 'IS', semester: 5, credits: 3, moduleNumber: '02'
 */
export function parseModuleCode(code: string): ParsedModuleCode | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();

  // Pattern: 2-letter prefix + semester digit (1-8) + credits digit (0-9) + 2-digit serial number
  const standardMatch = normalized.match(/^([A-Z]{2})([1-8])([0-9])([0-9]{2})$/);
  if (standardMatch) {
    return {
      prefix: standardMatch[1],
      semester: parseInt(standardMatch[2], 10),
      credits: parseInt(standardMatch[3], 10),
      moduleNumber: standardMatch[4],
    };
  }

  // Fallback for general 4-digit code (e.g. EC5060 -> semester: 5, default credits: 3)
  const legacyMatch = normalized.match(/^([A-Z]{2})([1-8])([0-9]{3})$/);
  if (legacyMatch) {
    return {
      prefix: legacyMatch[1],
      semester: parseInt(legacyMatch[2], 10),
      credits: 3,
      moduleNumber: legacyMatch[3],
    };
  }

  return null;
}
