import configSchemaFile from "../../../config.schema.json" with { type: "json" };
import { HttpError } from "../lib/http";
import { asObject } from "../lib/value";

type JsonRecord = Record<string, unknown>;

function readRootSchemaObject(): JsonRecord {
  const fileObject = asObject(configSchemaFile as unknown);
  const schema = asObject(fileObject?.schema);
  if (!schema) {
    throw new HttpError(500, "config.schema.json 格式无效：缺少 schema 对象。");
  }
  return schema;
}

function readRootSchemaProperties(): JsonRecord {
  const rootSchema = readRootSchemaObject();
  const properties = asObject(rootSchema.properties);
  if (!properties) {
    throw new HttpError(500, "config.schema.json 格式无效：缺少 schema.properties。");
  }
  return properties;
}

export function readConfigSectionSchema(section: string): JsonRecord {
  const properties = readRootSchemaProperties();
  const sectionSchema = asObject(properties[section]);
  if (!sectionSchema) {
    throw new HttpError(404, `未找到配置区 schema：${section}`);
  }
  return sectionSchema;
}
