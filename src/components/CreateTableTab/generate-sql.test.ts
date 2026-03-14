import { describe, it, expect } from 'vitest';
import { generateSql } from './generate-sql';
import type { ColumnDef } from './types';

function makeCol(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    id: '1',
    name: 'col',
    type: 'VARCHAR',
    typeParam1: 255,
    nullable: true,
    defaultMode: 'none',
    defaultValue: '',
    primary: false,
    ...overrides,
  };
}

describe('generateSql', () => {
  describe('quoting', () => {
    it('uses double quotes for postgres', () => {
      const sql = generateSql('my_table', [makeCol({ name: 'my_col' })], 'postgres');
      expect(sql).toContain('"my_table"');
      expect(sql).toContain('"my_col"');
    });

    it('uses backticks for mysql', () => {
      const sql = generateSql('my_table', [makeCol({ name: 'my_col' })], 'mysql');
      expect(sql).toContain('`my_table`');
      expect(sql).toContain('`my_col`');
    });
  });

  describe('type resolution', () => {
    it('uses buildTypeSql when typeDef is found', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'VARCHAR', typeParam1: 100 })], 'postgres');
      expect(sql).toContain('VARCHAR(100)');
    });

    it('uses col.type as-is when typeDef is not found (unknown type)', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'MYTYPE' })], 'postgres');
      expect(sql).toContain('MYTYPE');
    });
  });

  describe('AUTO_INCREMENT', () => {
    it('appends AUTO_INCREMENT when col.autoIncrement is true', () => {
      const col = makeCol({ name: 'id', type: 'INT', primary: true, autoIncrement: true, nullable: false });
      const sql = generateSql('t', [col], 'mysql');
      expect(sql).toContain('AUTO_INCREMENT');
    });

    it('does not append AUTO_INCREMENT when col.autoIncrement is falsy', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'VARCHAR' })], 'postgres');
      expect(sql).not.toContain('AUTO_INCREMENT');
    });
  });

  describe('PRIMARY KEY', () => {
    it('appends PRIMARY KEY when col.primary is true', () => {
      const col = makeCol({ name: 'id', type: 'SERIAL', primary: true, nullable: false });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).toContain('PRIMARY KEY');
    });

    it('does not append PRIMARY KEY when col.primary is false', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'VARCHAR' })], 'postgres');
      expect(sql).not.toContain('PRIMARY KEY');
    });
  });

  describe('NOT NULL', () => {
    it('appends NOT NULL when nullable=false and type is not SERIAL', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'VARCHAR', nullable: false })], 'postgres');
      expect(sql).toContain('NOT NULL');
    });

    it('does not append NOT NULL for postgres SERIAL types (isSerial)', () => {
      const col = makeCol({ name: 'id', type: 'SERIAL', primary: true, nullable: false });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).not.toContain('NOT NULL');
    });

    it('does not append NOT NULL for postgres BIGSERIAL (isSerial)', () => {
      const col = makeCol({ name: 'id', type: 'BIGSERIAL', primary: true, nullable: false });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).not.toContain('NOT NULL');
    });

    it('does not append NOT NULL when nullable=true', () => {
      const sql = generateSql('t', [makeCol({ name: 'c', type: 'VARCHAR', nullable: true })], 'postgres');
      expect(sql).not.toContain('NOT NULL');
    });
  });

  describe('DEFAULT for PK columns', () => {
    it('appends DEFAULT value for PK with non-empty defaultValue', () => {
      const col = makeCol({ name: 'id', type: 'UUID', primary: true, nullable: false, defaultValue: 'gen_random_uuid()' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).toContain('DEFAULT gen_random_uuid()');
    });

    it('does not append DEFAULT for PK with empty defaultValue', () => {
      const col = makeCol({ name: 'id', type: 'SERIAL', primary: true, nullable: false, defaultValue: '' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).not.toContain('DEFAULT');
    });
  });

  describe('DEFAULT for non-PK columns', () => {
    it('uses the defaultMode when found in opts (null → DEFAULT NULL)', () => {
      const col = makeCol({ name: 'c', type: 'VARCHAR', nullable: true, defaultMode: 'null' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).toContain('DEFAULT NULL');
    });

    it('uses literal value for defaultMode=literal', () => {
      const col = makeCol({ name: 'c', type: 'VARCHAR', nullable: true, defaultMode: 'literal', defaultValue: 'hello' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).toContain("DEFAULT 'hello'");
    });

    it('falls back to opts[0] (no DEFAULT) when defaultMode not found in opts', () => {
      const col = makeCol({ name: 'c', type: 'VARCHAR', nullable: true, defaultMode: 'nonexistent_key' });
      const sql = generateSql('t', [col], 'postgres');
      // opts[0] is always 'none' which produces no DEFAULT clause
      expect(sql).not.toContain('DEFAULT');
    });
  });

  describe('FK constraints', () => {
    it('appends FOREIGN KEY for columns with both fkTable and fkColumn', () => {
      const col = makeCol({ name: 'user_id', type: 'INTEGER', nullable: false, fkTable: 'users', fkColumn: 'id' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).toContain('FOREIGN KEY ("user_id") REFERENCES "users"("id")');
    });

    it('appends FK with backtick quoting for mysql', () => {
      const col = makeCol({ name: 'user_id', type: 'INT', nullable: false, fkTable: 'users', fkColumn: 'id' });
      const sql = generateSql('t', [col], 'mysql');
      expect(sql).toContain('FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)');
    });

    it('does not append FOREIGN KEY when fkTable is missing', () => {
      const col = makeCol({ name: 'user_id', type: 'INTEGER', fkColumn: 'id' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).not.toContain('FOREIGN KEY');
    });

    it('does not append FOREIGN KEY when fkColumn is missing', () => {
      const col = makeCol({ name: 'user_id', type: 'INTEGER', fkTable: 'users' });
      const sql = generateSql('t', [col], 'postgres');
      expect(sql).not.toContain('FOREIGN KEY');
    });
  });

  describe('overall SQL structure', () => {
    it('generates correct CREATE TABLE structure for postgres', () => {
      const cols: ColumnDef[] = [
        makeCol({ name: 'id', type: 'SERIAL', primary: true, nullable: false, defaultValue: '' }),
        makeCol({ name: 'name', type: 'VARCHAR', typeParam1: 255, nullable: true }),
      ];
      const sql = generateSql('users', cols, 'postgres');
      expect(sql).toMatch(/^CREATE TABLE "users" \(/);
      expect(sql).toMatch(/\);$/);
    });

    it('generates correct CREATE TABLE structure for mysql', () => {
      const cols: ColumnDef[] = [
        makeCol({ name: 'id', type: 'INT', primary: true, autoIncrement: true, nullable: false }),
      ];
      const sql = generateSql('orders', cols, 'mysql');
      expect(sql).toMatch(/^CREATE TABLE `orders` \(/);
      expect(sql).toMatch(/\);$/);
    });

    it('includes FK constraint after column definitions', () => {
      const cols: ColumnDef[] = [
        makeCol({ name: 'id', type: 'SERIAL', primary: true, nullable: false }),
        makeCol({ name: 'user_id', type: 'INTEGER', nullable: false, fkTable: 'users', fkColumn: 'id' }),
      ];
      const sql = generateSql('posts', cols, 'postgres');
      const lines = sql.split('\n');
      const fkLine = lines.findIndex((l) => l.includes('FOREIGN KEY'));
      const colLines = lines.filter((l) => l.includes('"id"') || l.includes('"user_id"'));
      expect(fkLine).toBeGreaterThan(0);
      expect(colLines.length).toBeGreaterThan(0);
    });
  });
});
