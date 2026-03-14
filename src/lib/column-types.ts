import type { DbType } from '@/types';

export type TypeParam = 'length' | 'precision-scale';

export interface PkStrategy {
  label: string;
  value: string;          // DEFAULT value to use; '' = no DEFAULT
  autoIncrement?: true;   // if set, signals AUTO_INCREMENT (MySQL) rather than a DEFAULT
}

export interface TypeDef {
  label: string;
  sql: string;
  params?: TypeParam;
  defaultLength?: number;
  defaultPrecision?: number;
  defaultScale?: number;
  // Non-PK default suggestion
  uuidAutoGen?: boolean;       // pre-fill default with gen_random_uuid() when type selected (non-PK)
  // PK behaviour
  pkForbidden?: boolean;       // cannot be a PK (JSON, BYTEA, FLOAT, etc.) — disabled when PK=true
  disabledWhenPk?: boolean;    // PG integers — disabled when PK=true (use SERIAL instead)
  pkOnly?: boolean;            // SERIAL types — disabled when PK=false
  serialPair?: string;         // INTEGER↔SERIAL auto-switch partner on PK toggle
  pkAutoIncrement?: boolean;   // SERIAL types — show "(auto-increment)" badge when PK=true
  pkStrategies?: PkStrategy[]; // generation dropdown shown when PK=true (UUID, MySQL ints)
  // Type resolution / normalisation
  aliases?: string[];          // DB-internal type names (e.g. int4, bool) → this TypeDef
}

// ── MySQL AUTO_INCREMENT strategy (reused across all integer types) ──────────

const MYSQL_AI_STRATEGIES: PkStrategy[] = [
  { label: 'AUTO_INCREMENT', value: '', autoIncrement: true },
  { label: '—', value: '' },
];

// ── Postgres types ────────────────────────────────────────────────────────────

const POSTGRES_TYPES: TypeDef[] = [
  // Integer — disabled when PK (use SERIAL equivalent instead)
  { label: 'SMALLINT',         sql: 'SMALLINT',         disabledWhenPk: true, serialPair: 'SMALLSERIAL', aliases: ['int2', 'smallint'] },
  { label: 'INTEGER',          sql: 'INTEGER',          disabledWhenPk: true, serialPair: 'SERIAL',      aliases: ['int4', 'int', 'integer'] },
  { label: 'BIGINT',           sql: 'BIGINT',           disabledWhenPk: true, serialPair: 'BIGSERIAL',   aliases: ['int8', 'bigint'] },
  // Serial (auto-increment) — only available as PK
  { label: 'SMALLSERIAL', sql: 'SMALLSERIAL', pkOnly: true, serialPair: 'SMALLINT', pkAutoIncrement: true, aliases: ['smallserial'] },
  { label: 'SERIAL',      sql: 'SERIAL',      pkOnly: true, serialPair: 'INTEGER',  pkAutoIncrement: true, aliases: ['serial'] },
  { label: 'BIGSERIAL',   sql: 'BIGSERIAL',   pkOnly: true, serialPair: 'BIGINT',   pkAutoIncrement: true, aliases: ['bigserial'] },
  // Floating-point — forbidden as PK
  { label: 'REAL',             sql: 'REAL',             pkForbidden: true, aliases: ['float4', 'real'] },
  { label: 'DOUBLE PRECISION', sql: 'DOUBLE PRECISION', pkForbidden: true, aliases: ['float8', 'double precision'] },
  // Exact numeric
  { label: 'DECIMAL', sql: 'DECIMAL', params: 'precision-scale', defaultPrecision: 10, defaultScale: 2, aliases: ['decimal'] },
  { label: 'NUMERIC', sql: 'NUMERIC', params: 'precision-scale', defaultPrecision: 10, defaultScale: 2, aliases: ['numeric'] },
  // Text
  { label: 'VARCHAR', sql: 'VARCHAR', params: 'length', defaultLength: 255, aliases: ['varchar', 'character varying'] },
  { label: 'CHAR',    sql: 'CHAR',    params: 'length', defaultLength: 1,   aliases: ['bpchar', 'char', 'character'] },
  { label: 'TEXT',    sql: 'TEXT',    aliases: ['text'] },
  // Boolean
  { label: 'BOOLEAN', sql: 'BOOLEAN', aliases: ['bool', 'boolean'] },
  // Date / Time
  { label: 'DATE',        sql: 'DATE',        aliases: ['date'] },
  { label: 'TIME',        sql: 'TIME',        aliases: ['time', 'time without time zone'] },
  { label: 'TIMETZ',      sql: 'TIMETZ',      aliases: ['timetz', 'time with time zone'] },
  { label: 'TIMESTAMP',   sql: 'TIMESTAMP',   aliases: ['timestamp', 'timestamp without time zone'] },
  { label: 'TIMESTAMPTZ', sql: 'TIMESTAMPTZ', aliases: ['timestamptz', 'timestamp with time zone'] },
  { label: 'INTERVAL',    sql: 'INTERVAL',    pkForbidden: true, aliases: ['interval'] },
  // UUID
  {
    label: 'UUID', sql: 'UUID',
    uuidAutoGen: true,
    pkStrategies: [
      { label: 'gen_random_uuid()', value: 'gen_random_uuid()' },
      { label: '—', value: '' },
    ],
    aliases: ['uuid'],
  },
  // JSON
  { label: 'JSON',  sql: 'JSON',  pkForbidden: true, aliases: ['json'] },
  { label: 'JSONB', sql: 'JSONB', pkForbidden: true, aliases: ['jsonb'] },
  // Binary / Network — forbidden as PK
  { label: 'BYTEA',   sql: 'BYTEA',   pkForbidden: true, aliases: ['bytea'] },
  { label: 'INET',    sql: 'INET',    pkForbidden: true, aliases: ['inet'] },
  { label: 'CIDR',    sql: 'CIDR',    pkForbidden: true, aliases: ['cidr'] },
  { label: 'MACADDR', sql: 'MACADDR', pkForbidden: true, aliases: ['macaddr'] },
];

// ── MySQL types ───────────────────────────────────────────────────────────────

const MYSQL_TYPES: TypeDef[] = [
  // Integer — AUTO_INCREMENT strategy when PK
  { label: 'TINYINT',   sql: 'TINYINT',   pkStrategies: MYSQL_AI_STRATEGIES, aliases: ['tinyint'] },
  { label: 'SMALLINT',  sql: 'SMALLINT',  pkStrategies: MYSQL_AI_STRATEGIES, aliases: ['smallint'] },
  { label: 'MEDIUMINT', sql: 'MEDIUMINT', pkStrategies: MYSQL_AI_STRATEGIES, aliases: ['mediumint'] },
  { label: 'INT',       sql: 'INT',       pkStrategies: MYSQL_AI_STRATEGIES, aliases: ['int', 'integer'] },
  { label: 'BIGINT',    sql: 'BIGINT',    pkStrategies: MYSQL_AI_STRATEGIES, aliases: ['bigint'] },
  // Floating-point — forbidden as PK
  { label: 'FLOAT',  sql: 'FLOAT',  pkForbidden: true, aliases: ['float'] },
  { label: 'DOUBLE', sql: 'DOUBLE', pkForbidden: true, aliases: ['double', 'double precision'] },
  // Exact numeric
  { label: 'DECIMAL', sql: 'DECIMAL', params: 'precision-scale', defaultPrecision: 10, defaultScale: 2, aliases: ['decimal'] },
  // Text
  { label: 'CHAR',       sql: 'CHAR',       params: 'length', defaultLength: 1,   aliases: ['char'] },
  { label: 'VARCHAR',    sql: 'VARCHAR',    params: 'length', defaultLength: 255,  aliases: ['varchar'] },
  { label: 'TINYTEXT',   sql: 'TINYTEXT',   pkForbidden: true, aliases: ['tinytext'] },
  { label: 'TEXT',       sql: 'TEXT',       pkForbidden: true, aliases: ['text'] },
  { label: 'MEDIUMTEXT', sql: 'MEDIUMTEXT', pkForbidden: true, aliases: ['mediumtext'] },
  { label: 'LONGTEXT',   sql: 'LONGTEXT',   pkForbidden: true, aliases: ['longtext'] },
  // Boolean
  { label: 'BOOLEAN', sql: 'BOOLEAN', aliases: ['boolean', 'bool'] },
  // Date / Time
  { label: 'DATE',      sql: 'DATE',      aliases: ['date'] },
  { label: 'TIME',      sql: 'TIME',      aliases: ['time'] },
  { label: 'DATETIME',  sql: 'DATETIME',  aliases: ['datetime'] },
  { label: 'TIMESTAMP', sql: 'TIMESTAMP', aliases: ['timestamp'] },
  { label: 'YEAR',      sql: 'YEAR',      aliases: ['year'] },
  // JSON — forbidden as PK
  { label: 'JSON', sql: 'JSON', pkForbidden: true, aliases: ['json'] },
  // Binary — forbidden as PK
  { label: 'TINYBLOB',   sql: 'TINYBLOB',   pkForbidden: true, aliases: ['tinyblob'] },
  { label: 'BLOB',       sql: 'BLOB',       pkForbidden: true, aliases: ['blob'] },
  { label: 'MEDIUMBLOB', sql: 'MEDIUMBLOB', pkForbidden: true, aliases: ['mediumblob'] },
  { label: 'LONGBLOB',   sql: 'LONGBLOB',   pkForbidden: true, aliases: ['longblob'] },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function getTypes(dbType: DbType): TypeDef[] {
  return dbType === 'postgres' ? POSTGRES_TYPES : MYSQL_TYPES;
}

export function getTypeDefBySql(dbType: DbType, sql: string): TypeDef | undefined {
  return getTypes(dbType).find((t) => t.sql === sql);
}

/** Resolve a raw DB type name (e.g. "int4", "bool") to its TypeDef. */
export function getTypeDefByAlias(dbType: DbType, rawType: string): TypeDef | undefined {
  const normalized = rawType.toLowerCase().replace(/\(.*\)/, '').trim();
  return getTypes(dbType).find((t) =>
    t.aliases?.some((a) => a.toLowerCase() === normalized)
  );
}

/**
 * Map a canonical SQL label (as returned by normalizeDbType) to a ColumnTypeCategory.
 */
export function sqlLabelToCategory(label: string): import('@/types').ColumnTypeCategory {
  switch (label) {
    case 'BOOLEAN': return 'boolean';
    case 'SMALLINT': case 'INTEGER': case 'BIGINT':
    case 'SMALLSERIAL': case 'SERIAL': case 'BIGSERIAL':
    case 'TINYINT': case 'MEDIUMINT': case 'INT':
    case 'REAL': case 'DOUBLE PRECISION': case 'FLOAT': case 'DOUBLE':
    case 'DECIMAL': case 'NUMERIC': case 'YEAR':
      return 'number';
    case 'DATE': return 'date';
    case 'TIME': case 'TIMETZ': return 'time';
    case 'TIMESTAMP': case 'TIMESTAMPTZ': case 'DATETIME': return 'datetime';
    case 'JSON': case 'JSONB': return 'json';
    default: return 'text';
  }
}

/**
 * Derive a ColumnTypeCategory from a raw DB type string (e.g. from information_schema).
 * Handles the MySQL tinyint(1) → boolean special case before normalisation strips the width.
 */
export function rawTypeToCategory(rawType: string, dbType?: DbType): import('@/types').ColumnTypeCategory {
  if (rawType.toLowerCase().trim() === 'tinyint(1)') return 'boolean';
  return sqlLabelToCategory(normalizeDbType(rawType, dbType));
}

/**
 * Normalise a raw DB type string to the canonical SQL label used in the UI.
 * e.g. "int4" → "BIGINT", "timestamptz" → "TIMESTAMPTZ", "character varying" → "VARCHAR"
 */
export function normalizeDbType(rawType: string, dbType?: DbType): string {
  if (!rawType) return '';
  const normalized = rawType.toLowerCase().replace(/\(.*\)/, '').trim();
  const list = dbType ? getTypes(dbType) : [...POSTGRES_TYPES, ...MYSQL_TYPES];
  for (const t of list) {
    if (t.aliases?.some((a) => a.toLowerCase() === normalized)) return t.sql;
  }
  // Fallback: uppercase (already stripped params)
  return normalized.toUpperCase();
}

// ── Default value options ─────────────────────────────────────────────────────

export interface DefaultOption {
  key: string;
  label: string;
  kind: 'none' | 'null' | 'literal' | 'expression';
  /** For date/time/number literal inputs. */
  inputType?: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
  /** Pre-filled value — no extra input needed (boolean TRUE/FALSE, expression presets). */
  presetValue?: string;
}

const INTEGER_SQL = new Set([
  'SMALLINT','INTEGER','BIGINT','TINYINT','MEDIUMINT','INT',
  'SMALLSERIAL','SERIAL','BIGSERIAL',
]);
const DECIMAL_SQL  = new Set(['REAL','DOUBLE PRECISION','FLOAT','DOUBLE','DECIMAL','NUMERIC']);
const STRING_SQL   = new Set(['VARCHAR','CHAR','TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT']);
const TIME_SQL     = new Set(['TIME','TIMETZ']);
const TS_SQL       = new Set(['TIMESTAMP','TIMESTAMPTZ','DATETIME']);
const JSON_SQL     = new Set(['JSON','JSONB']);
const BINARY_SQL   = new Set(['BYTEA','TINYBLOB','BLOB','MEDIUMBLOB','LONGBLOB']);
const NETWORK_SQL  = new Set(['INET','CIDR','MACADDR']);

export function getDefaultOptions(
  dbType: DbType,
  sql: string,
  nullable: boolean
): DefaultOption[] {
  const base: DefaultOption[] = [{ key: 'none', label: '—', kind: 'none' }];
  if (nullable) base.push({ key: 'null', label: 'NULL', kind: 'null' });

  if (sql === 'BOOLEAN') {
    return [...base,
      { key: 'true',  label: 'TRUE',  kind: 'literal', presetValue: 'TRUE'  },
      { key: 'false', label: 'FALSE', kind: 'literal', presetValue: 'FALSE' },
    ];
  }
  if (INTEGER_SQL.has(sql) || DECIMAL_SQL.has(sql)) {
    return [...base,
      { key: 'literal',    label: 'Value',      kind: 'literal',    inputType: 'number' },
      { key: 'expression', label: 'Expression', kind: 'expression' },
    ];
  }
  if (STRING_SQL.has(sql)) {
    return [...base,
      { key: 'literal',    label: 'Value',      kind: 'literal',    inputType: 'text' },
      { key: 'expression', label: 'Expression', kind: 'expression' },
    ];
  }
  if (sql === 'DATE') {
    const expr = dbType === 'postgres' ? 'CURRENT_DATE' : 'CURDATE()';
    return [...base,
      { key: 'literal',      label: 'Date',  kind: 'literal',    inputType: 'date' },
      { key: 'current_date', label: expr,    kind: 'expression', presetValue: expr },
      { key: 'expression',   label: 'Expression', kind: 'expression' },
    ];
  }
  if (TIME_SQL.has(sql)) {
    const expr = dbType === 'postgres' ? 'CURRENT_TIME' : 'CURTIME()';
    return [...base,
      { key: 'literal',      label: 'Time', kind: 'literal',    inputType: 'time' },
      { key: 'current_time', label: expr,   kind: 'expression', presetValue: expr },
      { key: 'expression',   label: 'Expression', kind: 'expression' },
    ];
  }
  if (TS_SQL.has(sql)) {
    const expr = dbType === 'postgres' ? 'CURRENT_TIMESTAMP' : 'NOW()';
    return [...base,
      { key: 'literal',    label: 'Datetime', kind: 'literal',    inputType: 'datetime-local' },
      { key: 'now',        label: expr,       kind: 'expression', presetValue: expr },
      { key: 'expression', label: 'Expression', kind: 'expression' },
    ];
  }
  if (sql === 'UUID') {
    return [...base,
      { key: 'literal',          label: 'Value',              kind: 'literal',    inputType: 'text' },
      { key: 'gen_random_uuid',  label: 'gen_random_uuid()',  kind: 'expression', presetValue: 'gen_random_uuid()' },
      { key: 'expression',       label: 'Expression',         kind: 'expression' },
    ];
  }
  if (sql === 'YEAR') {
    return [...base,
      { key: 'literal', label: 'Year', kind: 'literal', inputType: 'number' },
    ];
  }
  if (JSON_SQL.has(sql) || BINARY_SQL.has(sql)) {
    return [...base,
      { key: 'expression', label: 'Expression', kind: 'expression' },
    ];
  }
  if (NETWORK_SQL.has(sql) || sql === 'INTERVAL') {
    return [...base,
      { key: 'literal',    label: 'Value',      kind: 'literal',    inputType: 'text' },
      { key: 'expression', label: 'Expression', kind: 'expression' },
    ];
  }
  // Fallback
  return [...base,
    { key: 'literal',    label: 'Value',      kind: 'literal',    inputType: 'text' },
    { key: 'expression', label: 'Expression', kind: 'expression' },
  ];
}

/**
 * Build the SQL DEFAULT fragment for a column.
 * `value` is the raw user input (unquoted for literals, raw for expressions).
 */
export function buildDefaultSql(option: DefaultOption, value: string): string {
  switch (option.kind) {
    case 'none': return '';
    case 'null': return 'DEFAULT NULL';
    case 'literal': {
      if (option.presetValue !== undefined) return `DEFAULT ${option.presetValue}`;
      if (!value) return '';
      if (option.inputType === 'number') return `DEFAULT ${value}`;
      if (option.inputType === 'datetime-local') {
        return `DEFAULT '${value.replace('T', ' ')}'`;
      }
      // text / date / time → single-quote with escaping
      return `DEFAULT '${value.replace(/'/g, "''")}'`;
    }
    case 'expression': {
      const v = option.presetValue ?? value;
      return v ? `DEFAULT ${v}` : '';
    }
  }
}

export function buildTypeSql(def: TypeDef, param1?: number, param2?: number): string {
  if (def.params === 'length' && param1 !== undefined) {
    return `${def.sql}(${param1})`;
  }
  if (def.params === 'precision-scale' && param1 !== undefined && param2 !== undefined) {
    return `${def.sql}(${param1},${param2})`;
  }
  return def.sql;
}
