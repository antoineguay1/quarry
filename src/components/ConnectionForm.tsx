import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage, SuccessMessage } from "@/components/ui/status-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DbType, SavedConnection } from "@/types";

interface Props {
  onConnected: (name: string, defaultDatabase?: string) => void;
  onClose: () => void;
  initialConnection?: SavedConnection;
}

type FormConfig = {
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

const noAutocorrect = {
  autoComplete: "off",
} as const;

export default function ConnectionModal({ onConnected, onClose, initialConnection }: Props) {
  const isEditing = !!initialConnection;

  const [name, setName] = useState(initialConnection?.name ?? "");
  const [config, setConfig] = useState<FormConfig>(
    initialConnection
      ? {
          dbType: initialConnection.dbType,
          host: initialConnection.host,
          port: initialConnection.port,
          database: initialConnection.database,
          username: initialConnection.username,
          password: "",
        }
      : { dbType: "postgres", host: "localhost", port: 5432, database: "", username: "", password: "" }
  );

  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [connecting, setConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleDbTypeChange(value: string) {
    const dbType = value as DbType;
    const port = dbType === "postgres" ? 5432 : 3306;
    setConfig((prev) => ({ ...prev, dbType, port }));
  }

  function setField(field: keyof FormConfig, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleTest() {
    setTestStatus("testing");
    setError(null);
    try {
      if (isEditing && !config.password) {
        // No new password typed — test via keychain on the backend
        await invoke('test_connection', {
          dbType: config.dbType,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: null,
          savedName: initialConnection!.name,
        });
      } else {
        await invoke('test_connection', {
          dbType: config.dbType,
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          savedName: null,
        });
      }
      setTestStatus("ok");
    } catch (err) {
      setTestStatus("fail");
      setError(String(err));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setConnecting(true);
    setError(null);
    try {
      if (isEditing) {
        await invoke('update_connection', {
          oldName: initialConnection!.name,
          connection: {
            name: trimmedName,
            dbType: config.dbType,
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
          },
          newPassword: config.password || null,
        });
      } else {
        await invoke('save_connection', {
          connection: {
            name: trimmedName,
            dbType: config.dbType,
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
          },
          password: config.password,
        });
      }
      await invoke('connect_saved', { name: trimmedName });
      onConnected(trimmedName, config.database);
    } catch (err) {
      setError(String(err));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-card rounded-xl border shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">
            {isEditing ? "Edit Connection" : "New Connection"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>
              Connection Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Database"
              required
              {...noAutocorrect}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Database Type</Label>
            <Select value={config.dbType} onValueChange={handleDbTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Host</Label>
              <Input
                value={config.host}
                onChange={(e) => setField("host", e.target.value)}
                placeholder="localhost"
                {...noAutocorrect}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input
                type="number"
                value={config.port}
                onChange={(e) => setField("port", parseInt(e.target.value) || config.port)}
                {...noAutocorrect}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Default database</Label>
            <Input
              value={config.database}
              onChange={(e) => setField("database", e.target.value)}
              placeholder="my_database"
              {...noAutocorrect}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={config.username}
                onChange={(e) => setField("username", e.target.value)}
                placeholder="postgres"
                {...noAutocorrect}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={config.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder={isEditing ? "••••••••" : ""}
                  className="pr-9"
                  {...noAutocorrect}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Leave password empty to keep the existing one.
            </p>
          )}

          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
          {testStatus === "ok" && (
            <SuccessMessage message="Connection successful." onDismiss={() => setTestStatus("idle")} />
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-1.5"
              onClick={() => void handleTest()}
              disabled={testStatus === "testing" || connecting}
            >
              {testStatus === "testing" ? (
                <><Loader2 size={14} className="animate-spin" /> Testing…</>
              ) : "Test Connection"}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={connecting || !name.trim()}
            >
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
