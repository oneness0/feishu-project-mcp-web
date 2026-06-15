export function tryParseJsonStrings(obj: any): any {
  if (typeof obj === "string") {
    try {
      const parsed = JSON.parse(obj);
      if (typeof parsed === "object" && parsed !== null) {
        return tryParseJsonStrings(parsed);
      }
    } catch {
      // 忽略解析失败
    }
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(tryParseJsonStrings);
  } else if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      result[key] = tryParseJsonStrings(obj[key]);
    }
    return result;
  }
  return obj;
}
