import _ from 'lodash';
import { AxiosInstance } from 'axios';
import { ClassSchema, ColumnSchema, Permission } from './loose-schema';
import { ACL } from './type';

export interface ClassListItem {
  name: string;
  type: ClassSchema['type'];
}

export class LeanCloudClient {
  constructor(private client: AxiosInstance, readonly appId: string) {}

  async getClassList() {
    const { data } = await this.client.get<
      {
        name: string;
        'class-type': ClassSchema['type'];
      }[]
    >(`/1.1/data/${this.appId}/classes`);

    return data.map<ClassListItem>((item) => ({
      name: item.name,
      type: item['class-type'],
    }));
  }

  async getClassSchema(name: string) {
    const { data } = await this.client.get<{
      name: string;
      'class-type': string;
      at: ACL;
      permissions: {
        [action: string]: Permission;
      };
      schema: {
        [column: string]: {
          type: string;
          hidden?: boolean;
          read_only?: boolean;
          required?: boolean;
          default?: any;
          comment?: string;
          auto_increment?: boolean;
          className?: string;
          user_private?: boolean;
        };
      };
    }>(`/1.1/data/${this.appId}/classes/${name}`);

    const schema = _.mapValues(data.schema, (s, name) => ({ ...s, name }));

    if (schema.ACL && !schema.ACL.default && data.at) {
      schema.ACL.default = data.at;
    }

    const classSchema: ClassSchema = {
      name: data.name,
      type: data['class-type'],
      schema: schema,
      permissions: data.permissions,
    };

    return classSchema;
  }

  async createClass(data: ClassSchema) {
    await this.client.post(`/1.1/data/${this.appId}/classes`, {
      class_name: data.name,
      class_type: data.type,
      acl_template: data.schema.ACL?.default,
      permissions: data.permissions,
    });
  }

  async updateClassPermissions(
    name: string,
    permissions: ClassSchema['permissions']
  ) {
    await this.client.put(
      `/1.1/data/${this.appId}/classes/${name}/permissions`,
      {
        permissions,
      }
    );
  }

  async updateClassDefaultACL(name: string, defaultACL: ACL) {
    await this.client.put(
      `/1.1/data/${this.appId}/classes/${name}/columns/ACL`,
      {
        claid: name,
        id: 'ACL',
        default: JSON.stringify(defaultACL),
      }
    );
  }

  async createColumn(className: string, data: ColumnSchema) {
    await this.client.post(
      `/1.1/data/${this.appId}/classes/${className}/columns`,
      {
        claid: className,
        column: data.name,
        type: data.type,
        hidden: data.hidden,
        read_only: data.read_only,
        required: data.required,
        default: data.default,
        comment: data.comment,
        auto_increment: data.auto_increment,
        incrementValue: data.auto_increment ? 1 : undefined,
        class_name: data.className,
        user_private: data.user_private,
      }
    );
  }

  async updateColumn(className: string, data: ColumnSchema) {
    const defaultValue = encodeDefaultValue(data);

    await this.client.put(
      `/1.1/data/${this.appId}/classes/${className}/columns/${data.name}`,
      {
        claid: className,
        hidden: data.hidden ?? false,
        read_only: data.read_only ?? false,
        required: data.required ?? false,
        comment: data.comment ?? '',
        default: defaultValue ?? null,
        user_private: data.user_private ?? false,
      }
    );
  }
}

function encodeDefaultValue(column: ColumnSchema) {
  if (column.default === undefined) {
    return;
  }
  switch (column.type) {
    case 'String':
      return column.default;
    case 'Date':
      return column.default.iso;
    default:
      return JSON.stringify(column.default);
  }
}
