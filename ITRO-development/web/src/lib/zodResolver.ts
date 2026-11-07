import type { ZodType } from "zod";
import type { Resolver, FieldValues, FieldError } from "react-hook-form";

/**
 * Minimal zod resolver for react-hook-form (avoids the extra
 * @hookform/resolvers dependency). Validates with a Zod schema and maps
 * issues to react-hook-form's error shape.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, FieldError> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "root";
      if (!errors[path]) {
        errors[path] = { type: issue.code, message: issue.message } as FieldError;
      }
    }
    return { values: {}, errors: errors as any };
  };
}
