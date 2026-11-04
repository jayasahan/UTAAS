import { parseModuleCode } from './module-code-parser.util';

describe('ModuleCodeParserUtil', () => {
  it('should parse standard Ruhuna Engineering module code correctly (e.g. IS5302)', () => {
    const result = parseModuleCode('IS5302');

    expect(result).not.toBeNull();
    expect(result?.prefix).toBe('IS');
    expect(result?.semester).toBe(5);
    expect(result?.credits).toBe(3);
    expect(result?.moduleNumber).toBe('02');
  });

  it('should parse CE, EE, EC, ME, MN module codes correctly', () => {
    const ce = parseModuleCode('CE3301');
    expect(ce).toEqual({ prefix: 'CE', semester: 3, credits: 3, moduleNumber: '01' });

    const ec = parseModuleCode('EC4302');
    expect(ec).toEqual({ prefix: 'EC', semester: 4, credits: 3, moduleNumber: '02' });

    const mn = parseModuleCode('MN8601');
    expect(mn).toEqual({ prefix: 'MN', semester: 8, credits: 6, moduleNumber: '01' });
  });

  it('should handle legacy 4-digit codes like EC5060 gracefully', () => {
    const legacy = parseModuleCode('EC5060');

    expect(legacy).not.toBeNull();
    expect(legacy?.prefix).toBe('EC');
    expect(legacy?.semester).toBe(5);
  });

  it('should return null for invalid module codes', () => {
    expect(parseModuleCode('')).toBeNull();
    expect(parseModuleCode('INVALID')).toBeNull();
    expect(parseModuleCode('12345')).toBeNull();
  });
});
