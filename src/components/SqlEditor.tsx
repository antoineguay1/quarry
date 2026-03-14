import CodeMirror, { keymap } from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql';
import { Prec } from '@codemirror/state';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  schema?: Record<string, string[]>;
  dialect?: 'pg' | 'mysql';
}

export default function SqlEditor({
  value,
  onChange,
  onRun,
  schema = {},
  dialect = 'pg',
}: Props) {
  const { theme } = useTheme();
  const extensions = [
    sql({
      dialect: dialect === 'mysql' ? MySQL : PostgreSQL,
      schema,
    }),
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ),
  ];

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme === 'dark' ? vscodeDark : vscodeLight}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
      height="100%"
      className="rounded-md border overflow-hidden h-full"
      style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--quarry-font-size, 13px)' }}
    />
  );
}
