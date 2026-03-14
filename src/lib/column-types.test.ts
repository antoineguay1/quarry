import { describe, it, expect } from 'vitest';
import {
  normalizeDbType,
  rawTypeToCategory,
  getTypeDefByAlias,
  buildDefaultSql,
  getDefaultOptions,
  getTypes,
  getTypeDefBySql,
  buildTypeSql,
  sqlLabelToCategory,
  type DefaultOption,
} from './column-types';

describe('normalizeDbType', () => {
  it('int4 → INTEGER (postgres)', () => {
    expect(normalizeDbType('int4', 'postgres')).toBe('INTEGER');
  });

  it('strips params from VARCHAR(255)', () => {
    expect(normalizeDbType('VARCHAR(255)', 'postgres')).toBe('VARCHAR');
  });

  it('uppercases unknown types', () => {
    expect(normalizeDbType('foobar')).toBe('FOOBAR');
  });

  it('timestamptz → TIMESTAMPTZ', () => {
    expect(normalizeDbType('timestamptz', 'postgres')).toBe('TIMESTAMPTZ');
  });

  it('bool → BOOLEAN', () => {
    expect(normalizeDbType('bool', 'postgres')).toBe('BOOLEAN');
  });

  it('character varying → VARCHAR', () => {
    expect(normalizeDbType('character varying', 'postgres')).toBe('VARCHAR');
  });
});

describe('rawTypeToCategory', () => {
  it('bool → boolean', () => {
    expect(rawTypeToCategory('bool', 'postgres')).toBe('boolean');
  });

  it('int4 → number', () => {
    expect(rawTypeToCategory('int4', 'postgres')).toBe('number');
  });

  it('timestamptz → datetime', () => {
    expect(rawTypeToCategory('timestamptz', 'postgres')).toBe('datetime');
  });

  it('tinyint(1) MySQL → boolean', () => {
    expect(rawTypeToCategory('tinyint(1)', 'mysql')).toBe('boolean');
  });

  it('date → date', () => {
    expect(rawTypeToCategory('date', 'postgres')).toBe('date');
  });

  it('jsonb → json', () => {
    expect(rawTypeToCategory('jsonb', 'postgres')).toBe('json');
  });
});

describe('getTypeDefByAlias', () => {
  it('int4 postgres → def with sql=INTEGER', () => {
    const def = getTypeDefByAlias('postgres', 'int4');
    expect(def?.sql).toBe('INTEGER');
  });

  it('nonexistent → undefined', () => {
    expect(getTypeDefByAlias('postgres', 'nonexistent')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const def = getTypeDefByAlias('postgres', 'INT4');
    expect(def?.sql).toBe('INTEGER');
  });

  it('strips type params before lookup: VARCHAR(255) → VARCHAR', () => {
    const def = getTypeDefByAlias('postgres', 'VARCHAR(255)');
    expect(def?.sql).toBe('VARCHAR');
  });

  it('mysql tinyint resolves correctly', () => {
    const def = getTypeDefByAlias('mysql', 'tinyint');
    expect(def?.sql).toBe('TINYINT');
  });
});

describe('buildDefaultSql', () => {
  const noneOption: DefaultOption = { key: 'none', label: '—', kind: 'none' };
  const nullOption: DefaultOption = { key: 'null', label: 'NULL', kind: 'null' };
  const numberLiteral: DefaultOption = { key: 'literal', label: 'Value', kind: 'literal', inputType: 'number' };
  const textLiteral: DefaultOption = { key: 'literal', label: 'Value', kind: 'literal', inputType: 'text' };
  const exprWithPreset: DefaultOption = { key: 'expression', label: 'CURRENT_DATE', kind: 'expression', presetValue: 'CURRENT_DATE' };
  const exprNoPreset: DefaultOption = { key: 'expression', label: 'Expression', kind: 'expression' };

  it('kind=none → empty string', () => {
    expect(buildDefaultSql(noneOption, '')).toBe('');
  });

  it('kind=null → DEFAULT NULL', () => {
    expect(buildDefaultSql(nullOption, '')).toBe('DEFAULT NULL');
  });

  it('kind=literal number value → DEFAULT 42 (unquoted)', () => {
    expect(buildDefaultSql(numberLiteral, '42')).toBe('DEFAULT 42');
  });

  it("kind=literal text with single quote → SQL-escaped", () => {
    expect(buildDefaultSql(textLiteral, "O'Brien")).toBe("DEFAULT 'O''Brien'");
  });

  it('kind=literal empty value → empty string', () => {
    expect(buildDefaultSql(textLiteral, '')).toBe('');
  });

  it('kind=expression + presetValue → DEFAULT CURRENT_DATE', () => {
    expect(buildDefaultSql(exprWithPreset, '')).toBe('DEFAULT CURRENT_DATE');
  });

  it('kind=expression no presetValue + empty user value → empty string', () => {
    expect(buildDefaultSql(exprNoPreset, '')).toBe('');
  });

  it('kind=expression no presetValue + user value → DEFAULT <value>', () => {
    expect(buildDefaultSql(exprNoPreset, 'NOW()')).toBe('DEFAULT NOW()');
  });
});

describe('getDefaultOptions', () => {
  it('BOOLEAN nullable=true includes null option', () => {
    const opts = getDefaultOptions('postgres', 'BOOLEAN', true);
    expect(opts.some((o) => o.kind === 'null')).toBe(true);
  });

  it('BOOLEAN nullable=false does not include null option', () => {
    const opts = getDefaultOptions('postgres', 'BOOLEAN', false);
    expect(opts.some((o) => o.kind === 'null')).toBe(false);
  });

  it('UUID postgres includes gen_random_uuid()', () => {
    const opts = getDefaultOptions('postgres', 'UUID', false);
    expect(opts.some((o) => o.presetValue === 'gen_random_uuid()')).toBe(true);
  });

  it('DATE mysql uses CURDATE()', () => {
    const opts = getDefaultOptions('mysql', 'DATE', false);
    expect(opts.some((o) => o.presetValue === 'CURDATE()')).toBe(true);
  });

  it('DATE postgres uses CURRENT_DATE', () => {
    const opts = getDefaultOptions('postgres', 'DATE', false);
    expect(opts.some((o) => o.presetValue === 'CURRENT_DATE')).toBe(true);
  });

  it('TIMESTAMP postgres uses CURRENT_TIMESTAMP', () => {
    const opts = getDefaultOptions('postgres', 'TIMESTAMP', false);
    expect(opts.some((o) => o.presetValue === 'CURRENT_TIMESTAMP')).toBe(true);
  });

  it('INTEGER postgres non-nullable includes number literal option', () => {
    const opts = getDefaultOptions('postgres', 'INTEGER', false);
    expect(opts.some((o) => o.kind === 'literal' && o.inputType === 'number')).toBe(true);
  });

  it('VARCHAR postgres non-nullable includes text literal option', () => {
    const opts = getDefaultOptions('postgres', 'VARCHAR', false);
    expect(opts.some((o) => o.kind === 'literal' && o.inputType === 'text')).toBe(true);
  });

  it('TIME postgres includes CURRENT_TIME preset', () => {
    const opts = getDefaultOptions('postgres', 'TIME', false);
    expect(opts.some((o) => o.presetValue === 'CURRENT_TIME')).toBe(true);
  });

  it('TIME mysql includes CURTIME() preset', () => {
    const opts = getDefaultOptions('mysql', 'TIME', false);
    expect(opts.some((o) => o.presetValue === 'CURTIME()')).toBe(true);
  });

  it('TIMESTAMP mysql includes NOW() preset', () => {
    const opts = getDefaultOptions('mysql', 'TIMESTAMP', false);
    expect(opts.some((o) => o.presetValue === 'NOW()')).toBe(true);
  });

  it('UUID postgres has literal + gen_random_uuid() + expression options', () => {
    const opts = getDefaultOptions('postgres', 'UUID', false);
    expect(opts.some((o) => o.kind === 'literal' && o.inputType === 'text')).toBe(true);
    expect(opts.some((o) => o.presetValue === 'gen_random_uuid()')).toBe(true);
    expect(opts.some((o) => o.kind === 'expression' && !o.presetValue)).toBe(true);
  });

  it('YEAR mysql includes year literal with inputType number', () => {
    const opts = getDefaultOptions('mysql', 'YEAR', false);
    expect(opts.some((o) => o.kind === 'literal' && o.inputType === 'number')).toBe(true);
  });

  it('JSON postgres only has expression option (no literal)', () => {
    const opts = getDefaultOptions('postgres', 'JSON', false);
    expect(opts.some((o) => o.kind === 'literal')).toBe(false);
    expect(opts.some((o) => o.kind === 'expression')).toBe(true);
  });

  it('INET postgres includes text literal option', () => {
    const opts = getDefaultOptions('postgres', 'INET', false);
    expect(opts.some((o) => o.kind === 'literal' && o.inputType === 'text')).toBe(true);
  });
});

describe('getTypes', () => {
  it('returns non-empty array for postgres', () => {
    expect(getTypes('postgres').length).toBeGreaterThan(0);
  });

  it('returns non-empty array for mysql', () => {
    expect(getTypes('mysql').length).toBeGreaterThan(0);
  });

  it('postgres list includes a type with sql=INTEGER', () => {
    expect(getTypes('postgres').some((t) => t.sql === 'INTEGER')).toBe(true);
  });

  it('mysql list includes a type with sql=INT', () => {
    expect(getTypes('mysql').some((t) => t.sql === 'INT')).toBe(true);
  });
});

describe('getTypeDefBySql', () => {
  it('finds exact match for postgres INTEGER', () => {
    const def = getTypeDefBySql('postgres', 'INTEGER');
    expect(def?.sql).toBe('INTEGER');
  });

  it('returns undefined for unknown sql', () => {
    expect(getTypeDefBySql('postgres', 'UNKNOWN')).toBeUndefined();
  });

  it('mysql lookup for INT', () => {
    const def = getTypeDefBySql('mysql', 'INT');
    expect(def?.sql).toBe('INT');
  });
});

describe('buildTypeSql', () => {
  it('no params → returns bare sql', () => {
    const def = getTypeDefBySql('postgres', 'TEXT')!;
    expect(buildTypeSql(def)).toBe('TEXT');
  });

  it('params=length with param1 → VARCHAR(100)', () => {
    const def = getTypeDefBySql('postgres', 'VARCHAR')!;
    expect(buildTypeSql(def, 100)).toBe('VARCHAR(100)');
  });

  it('params=length without param1 → bare VARCHAR', () => {
    const def = getTypeDefBySql('postgres', 'VARCHAR')!;
    expect(buildTypeSql(def)).toBe('VARCHAR');
  });

  it('params=precision-scale with both → DECIMAL(10,2)', () => {
    const def = getTypeDefBySql('postgres', 'DECIMAL')!;
    expect(buildTypeSql(def, 10, 2)).toBe('DECIMAL(10,2)');
  });

  it('params=precision-scale with only param1 → bare DECIMAL', () => {
    const def = getTypeDefBySql('postgres', 'DECIMAL')!;
    expect(buildTypeSql(def, 10)).toBe('DECIMAL');
  });
});

describe('sqlLabelToCategory', () => {
  it('BOOLEAN → boolean', () => expect(sqlLabelToCategory('BOOLEAN')).toBe('boolean'));
  it('INTEGER → number', () => expect(sqlLabelToCategory('INTEGER')).toBe('number'));
  it('BIGINT → number', () => expect(sqlLabelToCategory('BIGINT')).toBe('number'));
  it('DECIMAL → number', () => expect(sqlLabelToCategory('DECIMAL')).toBe('number'));
  it('DATE → date', () => expect(sqlLabelToCategory('DATE')).toBe('date'));
  it('TIME → time', () => expect(sqlLabelToCategory('TIME')).toBe('time'));
  it('TIMETZ → time', () => expect(sqlLabelToCategory('TIMETZ')).toBe('time'));
  it('TIMESTAMP → datetime', () => expect(sqlLabelToCategory('TIMESTAMP')).toBe('datetime'));
  it('DATETIME → datetime', () => expect(sqlLabelToCategory('DATETIME')).toBe('datetime'));
  it('JSON → json', () => expect(sqlLabelToCategory('JSON')).toBe('json'));
  it('JSONB → json', () => expect(sqlLabelToCategory('JSONB')).toBe('json'));
  it('TEXT → text (default)', () => expect(sqlLabelToCategory('TEXT')).toBe('text'));
  it('VARCHAR → text (default)', () => expect(sqlLabelToCategory('VARCHAR')).toBe('text'));
});

describe('buildDefaultSql additions', () => {
  it('kind=literal datetime-local replaces T with space', () => {
    const opt: DefaultOption = { key: 'literal', label: 'Datetime', kind: 'literal', inputType: 'datetime-local' };
    expect(buildDefaultSql(opt, '2024-01-15T10:30')).toBe("DEFAULT '2024-01-15 10:30'");
  });

  it('kind=literal with boolean presetValue → DEFAULT TRUE', () => {
    const opt: DefaultOption = { key: 'true', label: 'TRUE', kind: 'literal', presetValue: 'TRUE' };
    expect(buildDefaultSql(opt, '')).toBe('DEFAULT TRUE');
  });
});
