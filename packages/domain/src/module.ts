export type ModuleDependency = string;

export interface ModuleCommand {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly scope?: readonly string[];
  readonly description: string;
  readonly requires?: readonly string[];
}

export interface ModuleJob {
  readonly name: string;
  readonly queue: string;
}

export interface ModuleManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly dependencies: readonly ModuleDependency[];
  readonly permissions: readonly string[];
  readonly commands: readonly ModuleCommand[];
  readonly jobs: readonly ModuleJob[];
  readonly featureFlag?: string;
}

export interface LoadedModule {
  readonly manifest: ModuleManifest;
  readonly initializedAt: Date;
}
