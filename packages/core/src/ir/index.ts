export { swagger2ToIR } from './swagger2-to-ir.js';
export { oas3ToIR } from './oas3-to-ir.js';
export { normalizeSchema } from './normalize-schema.js';
export type {
  IRSpec,
  IRPathItem,
  IROperation,
  IRParameter,
  ParameterLocation,
  IRRequestBody,
  IRResponse,
  IRMediaType,
  IRHeader,
  IRSchema,
  IRSecurityScheme,
  IRSecuritySchemeType,
  IROAuthFlows,
  IROAuthFlow,
  IRSecurityRequirement,
  IRServer,
  IRServerVariable,
  IRTag,
  HttpMethod,
  JsonPointer,
  NormalizeOptions,
} from './types.js';
