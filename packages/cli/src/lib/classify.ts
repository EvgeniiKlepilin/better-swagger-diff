import type { DiffResult, PathDiff, OperationDiff, ParameterDiff, ResponseDiff } from '@better-swagger-diff/core';

export type Severity = 'breaking' | 'warning' | 'info';

export interface ClassifiedChange {
  severity: Severity;
  message: string;
  /** Human-readable location, e.g. "DELETE /pets/{petId}" */
  location: string;
  jsonPointer: string;
}

export interface ClassificationResult {
  changes: ClassifiedChange[];
  breaking: ClassifiedChange[];
  warnings: ClassifiedChange[];
  info: ClassifiedChange[];
  hasBreaking: boolean;
}

export function classifyDiff(result: DiffResult): ClassificationResult {
  const changes: ClassifiedChange[] = [];

  for (const pathDiff of [...result.paths, ...result.webhooks]) {
    classifyPathDiff(pathDiff, changes);
  }

  for (const secChange of result.securitySchemes) {
    if (secChange.type === 'removed') {
      changes.push({
        severity: 'warning',
        message: 'security scheme removed',
        location: secChange.path,
        jsonPointer: secChange.path,
      });
    } else if (secChange.type === 'added') {
      changes.push({
        severity: 'info',
        message: 'security scheme added',
        location: secChange.path,
        jsonPointer: secChange.path,
      });
    }
  }

  const breaking = changes.filter((c) => c.severity === 'breaking');
  const warnings = changes.filter((c) => c.severity === 'warning');
  const info = changes.filter((c) => c.severity === 'info');

  return { changes, breaking, warnings, info, hasBreaking: breaking.length > 0 };
}

function classifyPathDiff(pathDiff: PathDiff, out: ClassifiedChange[]): void {
  if (pathDiff.type === 'removed') {
    out.push({
      severity: 'breaking',
      message: 'path removed',
      location: pathDiff.path,
      jsonPointer: pathDiff.jsonPointer,
    });
    return;
  }
  if (pathDiff.type === 'added') {
    out.push({
      severity: 'info',
      message: 'path added',
      location: pathDiff.path,
      jsonPointer: pathDiff.jsonPointer,
    });
    return;
  }
  for (const opDiff of pathDiff.operations) {
    classifyOperationDiff(opDiff, out);
  }
}

function classifyOperationDiff(opDiff: OperationDiff, out: ClassifiedChange[]): void {
  const loc = `${opDiff.method.toUpperCase()} ${opDiff.path}`;
  if (opDiff.type === 'removed') {
    out.push({
      severity: 'breaking',
      message: 'operation removed',
      location: loc,
      jsonPointer: opDiff.jsonPointer,
    });
    return;
  }
  if (opDiff.type === 'added') {
    out.push({
      severity: 'info',
      message: 'operation added',
      location: loc,
      jsonPointer: opDiff.jsonPointer,
    });
    return;
  }
  for (const change of opDiff.changes) {
    if (change.path.endsWith('/deprecated') && change.after === true) {
      out.push({
        severity: 'warning',
        message: 'operation deprecated',
        location: loc,
        jsonPointer: change.path,
      });
    }
  }
  for (const paramDiff of opDiff.parameters) {
    classifyParameterDiff(paramDiff, loc, out);
  }
  for (const respDiff of opDiff.responses) {
    classifyResponseDiff(respDiff, loc, out);
  }
}

function classifyParameterDiff(paramDiff: ParameterDiff, operationLoc: string, out: ClassifiedChange[]): void {
  const paramLoc = `${operationLoc} — parameter "${paramDiff.name}" (${paramDiff.in})`;
  if (paramDiff.type === 'added') {
    const required = paramDiff.after?.required === true;
    out.push({
      severity: required ? 'breaking' : 'info',
      message: required ? 'required parameter added' : 'optional parameter added',
      location: paramLoc,
      jsonPointer: paramDiff.jsonPointer,
    });
    return;
  }
  if (paramDiff.type === 'removed') {
    const wasRequired = paramDiff.before?.required === true;
    out.push({
      severity: wasRequired ? 'warning' : 'info',
      message: wasRequired ? 'required parameter removed' : 'optional parameter removed',
      location: paramLoc,
      jsonPointer: paramDiff.jsonPointer,
    });
    return;
  }
  const becameRequired = paramDiff.before?.required === false && paramDiff.after?.required === true;
  if (becameRequired) {
    out.push({
      severity: 'breaking',
      message: 'parameter became required',
      location: paramLoc,
      jsonPointer: paramDiff.jsonPointer,
    });
  }
}

function classifyResponseDiff(respDiff: ResponseDiff, operationLoc: string, out: ClassifiedChange[]): void {
  const respLoc = `${operationLoc} — response ${respDiff.statusCode}`;
  if (respDiff.type === 'removed') {
    out.push({
      severity: 'warning',
      message: 'response status code removed',
      location: respLoc,
      jsonPointer: respDiff.jsonPointer,
    });
    return;
  }
  if (respDiff.type === 'added') {
    out.push({
      severity: 'info',
      message: 'response status code added',
      location: respLoc,
      jsonPointer: respDiff.jsonPointer,
    });
  }
}
