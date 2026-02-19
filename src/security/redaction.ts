const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{16,}\b/g,
  /\bghp_[a-zA-Z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s\n]+/gi,
  /\bBearer\s+[A-Za-z0-9._\-]{10,}\b/g
];

const PATH_EXCLUSIONS = [/\.env/i, /secrets?/i, /id_rsa/i, /\.pem$/i];

export interface RedactionResult {
  value: string;
  redacted: boolean;
  indicators: string[];
}

const mask = (input: string): string => {
  if (input.length <= 8) {
    return '[REDACTED]';
  }
  return `${input.slice(0, 4)}…[REDACTED]…${input.slice(-2)}`;
};

export const shouldExcludePath = (filePath: string): boolean => {
  return PATH_EXCLUSIONS.some((pattern) => pattern.test(filePath));
};

export const redactText = (input: string, sourcePath?: string): RedactionResult => {
  if (sourcePath && shouldExcludePath(sourcePath)) {
    return {
      value: '[REDACTED:EXCLUDED_PATH]',
      redacted: true,
      indicators: ['path_excluded']
    };
  }

  let value = input;
  const indicators: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) {
      indicators.push(`pattern:${pattern.source}`);
      pattern.lastIndex = 0;
      value = value.replace(pattern, (match) => mask(match));
    }
  }

  return {
    value,
    redacted: indicators.length > 0,
    indicators
  };
};
