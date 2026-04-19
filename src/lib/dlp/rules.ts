export type PiiKind =
  | "phone_cn"
  | "idcard_cn"
  | "email"
  | "bank_card"
  | "salary"
  | "sensitive_field";

export interface PiiRule {
  kind: PiiKind;
  regex: RegExp;
  mask: (raw: string) => string;
  severity: "low" | "medium" | "high";
}

/**
 * 基础 PII 识别规则集。
 * 生产中应使用更完备的检测器（NER 模型、字典、Luhn 校验等），此处演示足够。
 */
export const PII_RULES: PiiRule[] = [
  {
    kind: "phone_cn",
    regex: /\b1[3-9]\d{9}\b/g,
    mask: (raw) => raw.slice(0, 3) + "****" + raw.slice(-4),
    severity: "medium",
  },
  {
    kind: "idcard_cn",
    regex: /\b\d{17}[\dxX]\b/g,
    mask: (raw) => raw.slice(0, 4) + "**********" + raw.slice(-4),
    severity: "high",
  },
  {
    kind: "email",
    regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    mask: (raw) => {
      const [name, domain] = raw.split("@");
      return (name.slice(0, 1) + "***@" + domain).toLowerCase();
    },
    severity: "low",
  },
  {
    kind: "bank_card",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    mask: (raw) => {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 13) return raw;
      return digits.slice(0, 4) + " **** **** " + digits.slice(-4);
    },
    severity: "high",
  },
];

/**
 * 按字段敏感等级做更严格的处理（Tool.sensitiveFields 中声明的字段）。
 */
export function maskFieldValue(value: unknown, severity: "low" | "medium" | "high" = "high"): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return severity === "low" ? value : "***";
  if (typeof value === "string") {
    if (value.length <= 2) return "**";
    if (severity === "low") return value.slice(0, 1) + "***";
    return value.slice(0, 1) + "***" + value.slice(-1);
  }
  return "***";
}
