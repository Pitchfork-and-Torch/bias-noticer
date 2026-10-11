/**
 * ESM resolver: append .ts to extensionless relative specifiers.
 * Lets Node 24 type-stripping import the production lib without a bundler.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    const parent = fileURLToPath(context.parentURL);
    const tsPath = join(dirname(parent), specifier + ".ts");
    if (existsSync(tsPath)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(tsPath).href,
      };
    }
  }
  return nextResolve(specifier, context);
}
