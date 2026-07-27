import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Injectable } from "@nestjs/common";

export interface DevInfo {
  name: string;
  version: string;
  environment: string;
}

interface PackageJsonShape {
  name: string;
  version: string;
}

function readOwnPackageJson(): PackageJsonShape {
  const url = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf-8")) as PackageJsonShape;
}

@Injectable()
export class AppService {
  private readonly packageJson = readOwnPackageJson();

  getDevInfo(): DevInfo {
    return {
      name: this.packageJson.name,
      version: this.packageJson.version,
      environment: process.env["NODE_ENV"] ?? "development",
    };
  }
}
