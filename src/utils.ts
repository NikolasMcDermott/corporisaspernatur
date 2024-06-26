import Ajv, {ErrorObject, Options as AjvOptions} from 'ajv';
import addFormats from 'ajv-formats'
import {OpenAPIV3} from 'openapi-types';

export type OneOrMany<T> = T | Array<T>;

// The "not a function restriction" solves TS2349 and enables using typeof === 'function' to determine if T is callable.
// eslint-disable-next-line @typescript-eslint/ban-types
export type Resolvable<T> = T extends Function ? never : T | (() => T);

export function resolve<T>(resolvable: Resolvable<T>): T {
  return typeof resolvable === 'function' ? resolvable() : resolvable;
}

export function formatValidationError(error: ErrorObject): string {
  return `At '${error.dataPath}': ${Object.entries(error.params)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ')}`;
}

export function formatArray<T>(items: T[], formatter: (item: T) => string, prefix = `\n  * `): string {
  return items.map(item => `${prefix}${formatter(item)}`).join('');
}

export type ParameterType = 'header' | 'query' | 'path' | 'cookie';

export function getParameterMap(
    {parameters = []}: OpenAPIV3.OperationObject,
    type: ParameterType
): Record<string, OpenAPIV3.ParameterBaseObject> {
  const result: Record<string, OpenAPIV3.ParameterBaseObject> = {};

  for (const parameter of parameters) {
    if ('in' in parameter && parameter.in === type) {
      result[parameter.name] = parameter;
    }
  }

  return result;
}

export function getParametersSchema(
    parameters: Record<string, OpenAPIV3.ParameterBaseObject>
): OpenAPIV3.SchemaObject {
  const result = {
    type: 'object',
    required: [] as string[],
    properties: {} as Record<string, any>,
    additionalProperties: true
  };

  for (const [name, parameter] of Object.entries(parameters)) {
    const {required = false, schema = {}} = parameter;

    result.properties[name] = schema;

    if (required) {
      result.required.push(name);
    }
  }

  return result as OpenAPIV3.SchemaObject;
}

// Note that errors is an out parameter
export function matchSchema<T, U>(
    source: Readonly<T>,
    schema: OpenAPIV3.SchemaObject,
    errors: ErrorObject[],
    ajvOptions?: AjvOptions): U {
  // Ajv mutates the passed object so we pass a copy
  const result = cloneObject(source);
  const validate = addFormats(new Ajv({...ajvOptions, coerceTypes: 'array'})).compile(schema);

  validate(result);

  if (validate.errors) {
    errors.push(...validate.errors);
  }

  return result;
}

function cloneObject<T>(source: Readonly<T>) {
  return JSON.parse(JSON.stringify(source));
}

/**
 * Map the values of an object
 * @param obj Source object
 * @param func Transform function
 */
export function mapObject<K extends string, V, W>(
    obj: Record<K, V>,
    func: (value: V, key: K, obj: Record<K, V>) => W
): Record<K, W> {
  return Object.fromEntries(Object.entries<V>(obj).map(([k, v]) => [k, func(v, k as K, obj)])) as Record<K, W>;
}

export function transform<T, U>(value: OneOrMany<T>, func: (value: T) => U): OneOrMany<U> {
  return Array.isArray(value) ? value.map(func) : func(value);
}

/**
 * Apply a transformation to a single value or an array of values
 * @param func Transform function
 * @returns Single transformed value or array of transformed values
 */
export function oneOrMany<T, U>(func: (value: T) => U): (value: OneOrMany<T>) => OneOrMany<U> {
  return value => Array.isArray(value) ? value.map(func) : func(value);
}

/**
 * Return a number range validator function
 * @param min Min value (inclusive)
 * @param max Max value (exclusive)
 */
export function inRange(min: number, max: number): (value: number) => boolean {
  return value => value >= min && value < max;
}