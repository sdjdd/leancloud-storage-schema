import _ from 'lodash';
import { z } from 'zod';
import { ClassSchema } from './loose-schema';

const zodACL = z.record(
  z.union([
    z.object({
      read: z.literal(true),
      write: z.literal(true),
    }),
    z.object({
      read: z.literal(true),
    }),
    z.object({
      write: z.literal(true),
    }),
  ])
);

const zodBasicColumn = z.object({
  hidden: z.boolean().default(false),
  read_only: z.boolean().default(false),
  required: z.boolean().default(false),
  comment: z.string().default(''),
});

const zodStringColumn = zodBasicColumn.extend({
  type: z.literal('String'),
  default: z.string().optional(),
});

const zodNumberColumn = zodBasicColumn.extend({
  type: z.literal('Number'),
  auto_increment: z.boolean().default(false),
  default: z.number().optional(),
});

const zodBooleanColumn = zodBasicColumn.extend({
  type: z.literal('Boolean'),
  default: z.boolean().optional(),
});

const zodDateColumn = zodBasicColumn.extend({
  type: z.literal('Date'),
  default: z
    .object({
      __type: z.literal('Date'),
      iso: z.string(),
    })
    .optional(),
});

const zodFileColumn = zodBasicColumn.extend({
  type: z.literal('File'),
  default: z
    .object({
      __type: z.literal('Pointer'),
      className: z.literal('_File'),
      objectId: z.string(),
    })
    .optional(),
});

const zodArrayColumn = zodBasicColumn.extend({
  type: z.literal('Array'),
  default: z.array(z.any()).optional(),
});

const zodObjectColumn = zodBasicColumn.extend({
  type: z.literal('Object'),
  default: z.record(z.any()).optional(),
});

const zodGeoPointColumn = zodBasicColumn.extend({
  type: z.literal('GeoPoint'),
  default: z
    .object({
      __type: z.literal('GeoPoint'),
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

const zodPointerColumn = zodBasicColumn.extend({
  type: z.literal('Pointer'),
  className: z.string(),
  default: z
    .object({
      __type: z.literal('Pointer'),
      className: z.string(),
      objectId: z.string(),
    })
    .optional(),
});

const zodAnyColumn = zodBasicColumn.extend({
  type: z.literal('Any'),
  default: z.any(),
});

const zodACLColumn = zodBasicColumn.extend({
  type: z.literal('ACL'),
  default: zodACL.optional(),
});

const zodColumn = z.discriminatedUnion('type', [
  zodStringColumn,
  zodNumberColumn,
  zodBooleanColumn,
  zodDateColumn,
  zodFileColumn,
  zodArrayColumn,
  zodObjectColumn,
  zodGeoPointColumn,
  zodPointerColumn,
  zodAnyColumn,
  zodACLColumn,
]);

const zodPermission = z.union([
  z
    .object({
      roles: z.array(z.string()),
      users: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      onlySignInUsers: z.literal(true),
    })
    .strict(),
  z
    .object({
      '*': z.literal(true),
    })
    .strict(),
]);

const zodJsonSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['normal', 'log']).default('normal'),
  schema: z.record(zodColumn),
  permissions: z
    .object({
      add_fields: zodPermission,
      create: zodPermission,
      delete: zodPermission,
      update: zodPermission,
      find: zodPermission,
      get: zodPermission,
    })
    .strict(),
});

export function parseJsonSchema(rawJson: any, className: string) {
  const json = zodJsonSchema.parse(rawJson);
  const localSchema: ClassSchema = {
    name: json.name || className,
    type: json.type,
    schema: {},
    permissions: json.permissions,
  };

  Object.entries(json.schema).forEach(([name, jsonSchema]) => {
    localSchema.schema[name] = {
      name,
      ...jsonSchema,
    };
  });

  return localSchema;
}

export async function encode(schema: ClassSchema) {
  const result: any = {
    type: schema.type === 'normal' ? undefined : schema.type,
    schema: {},
    permissions: sortObjectKeys(schema.permissions),
  };

  const { objectId, ACL, createdAt, updatedAt, ...columns } = schema.schema;
  const sortedColumns = Object.values(columns).sort((a, b) => {
    return a.name > b.name ? 1 : -1;
  });

  [objectId, ACL, ...sortedColumns, createdAt, updatedAt].forEach((schema) => {
    result.schema[schema.name] = {
      type: schema.type,
      hidden: schema.hidden || undefined,
      read_only: schema.read_only || undefined,
      required: schema.required || undefined,
      comment: schema.comment || undefined,
      default: schema.default,
      auto_increment: schema.auto_increment || undefined,
      className: schema.className || undefined,
      user_private: schema.user_private || undefined,
    };
  });

  return result;
}

function sortObjectKeys(
  obj: Record<string, any>,
  cmpFn?: (a: string, b: string) => number
) {
  return Object.keys(obj)
    .sort(cmpFn)
    .reduce<typeof obj>((newObj, key) => {
      newObj[key] = obj[key];
      return newObj;
    }, {});
}
