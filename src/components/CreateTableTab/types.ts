export interface ColumnDef {
  id: string;
  name: string;
  type: string;
  typeParam1?: number;
  typeParam2?: number;
  nullable: boolean;
  defaultMode: string; // key from DefaultOption; 'none' = no DEFAULT clause
  defaultValue: string; // raw user input (unquoted); also holds PK strategy expression
  primary: boolean;
  autoIncrement?: boolean;
  fkTable?: string;
  fkColumn?: string;
}

export interface FkColInfo {
  name: string;
  rawType: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
}
