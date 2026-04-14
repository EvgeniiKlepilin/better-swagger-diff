import yaml from 'js-yaml';

/**
 * Parse a raw string as JSON or YAML and return the resulting object.
 *
 * Detection heuristic: strings whose first non-whitespace character is `{`
 * or `[` are treated as JSON; everything else is treated as YAML (which is a
 * superset of JSON anyway, but the fast-path avoids the YAML parser overhead
 * for large JSON specs).
 *
 * @throws {Error} with a descriptive message on parse failure.
 */
export function parseYamlOrJson(content: string): unknown {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error('Spec content is empty.');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(content) as unknown;
    } catch (err) {
      throw new Error(
        `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  try {
    const result = yaml.load(content);
    if (result === null || result === undefined) {
      throw new Error('Spec content parsed to null/undefined — the file may be empty.');
    }
    return result;
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      throw new Error(`Invalid YAML: ${err.message}`);
    }
    throw err;
  }
}
