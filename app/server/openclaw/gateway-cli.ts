import { asObject, readNonEmptyString } from "../lib/value";
import { runOpenclawCliJson, type OpenclawCliResult } from "./cli";

export type GatewayCliCallResult<T = unknown> = {
  payload: T;
  raw: OpenclawCliResult;
  envelope: unknown;
};

function unwrapPayload(data: unknown): unknown {
  const obj = asObject(data);
  if (!obj) {
    return data;
  }

  if (obj.ok === false) {
    const err =
      readNonEmptyString(obj.error) ||
      readNonEmptyString(asObject(obj.result)?.error) ||
      "gateway call 返回失败";
    throw new Error(err);
  }

  if (Object.prototype.hasOwnProperty.call(obj, "payload")) {
    return obj.payload;
  }

  if (Object.prototype.hasOwnProperty.call(obj, "result")) {
    const resultObj = asObject(obj.result);
    if (resultObj && Object.prototype.hasOwnProperty.call(resultObj, "payload")) {
      return resultObj.payload;
    }
    return obj.result;
  }

  if (Object.prototype.hasOwnProperty.call(obj, "data")) {
    return obj.data;
  }

  return data;
}

export async function callGatewayMethodViaCli<T = unknown>(
  method: string,
  params?: unknown
): Promise<GatewayCliCallResult<T>> {
  const args = ["gateway", "call", method];
  if (params !== undefined) {
    args.push("--params", JSON.stringify(params));
  }

  const { result, data } = await runOpenclawCliJson(args);
  return {
    payload: unwrapPayload(data) as T,
    raw: result,
    envelope: data,
  };
}
