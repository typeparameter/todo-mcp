import { fileURLToPath } from "node:url";

export function getDependencyPath(dependency: string) {
  return fileURLToPath(import.meta.resolve(dependency));
}
