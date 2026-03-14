import {
  buildDefaultSql,
  buildTypeSql,
  getDefaultOptions,
  getTypeDefBySql,
} from '@/lib/column-types';
import type { DbType } from '@/types';
import type { ColumnDef } from './types';

const PG_SERIAL_TYPES = ['SMALLSERIAL', 'SERIAL', 'BIGSERIAL'];

export function generateSql(
  tableName: string,
  columns: ColumnDef[],
  dbType: DbType,
): string {
  const q =
    dbType === 'postgres' ? (n: string) => `"${n}"` : (n: string) => `\`${n}\``;

  const colDefs = columns.map((col) => {
    const typeDef = getTypeDefBySql(dbType, col.type);
    const typeSql = typeDef
      ? buildTypeSql(typeDef, col.typeParam1, col.typeParam2)
      : col.type;

    const isSerial =
      dbType === 'postgres' && PG_SERIAL_TYPES.includes(col.type);

    const parts: string[] = [q(col.name), typeSql];
    if (col.autoIncrement) parts.push('AUTO_INCREMENT');
    if (col.primary) parts.push('PRIMARY KEY');
    if (!col.nullable && !isSerial) parts.push('NOT NULL');

    // PK columns use defaultValue directly (set by pkStrategies — raw SQL expression)
    if (col.primary) {
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
    } else {
      const opts = getDefaultOptions(dbType, col.type, col.nullable);
      const opt = opts.find((o) => o.key === col.defaultMode) ?? opts[0];
      const defaultSql = buildDefaultSql(opt, col.defaultValue);
      if (defaultSql) parts.push(defaultSql);
    }

    return '  ' + parts.join(' ');
  });

  const fkConstraints = columns
    .filter((col) => col.fkTable && col.fkColumn)
    .map(
      (col) =>
        `  FOREIGN KEY (${q(col.name)}) REFERENCES ${q(col.fkTable!)}(${q(col.fkColumn!)})`,
    );

  return `CREATE TABLE ${q(tableName)} (\n${[...colDefs, ...fkConstraints].join(',\n')}\n);`;
}
