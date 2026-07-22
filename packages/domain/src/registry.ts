import type { LoadedModule, ModuleManifest } from "./module.js";

export class ModuleRegistry {
  private readonly modules = new Map<string, LoadedModule>();

  register(manifest: ModuleManifest): LoadedModule {
    const loaded: LoadedModule = {
      manifest,
      initializedAt: new Date(),
    };

    this.modules.set(manifest.name, loaded);
    return loaded;
  }

  get(name: string): LoadedModule | undefined {
    return this.modules.get(name);
  }

  list(): readonly LoadedModule[] {
    return Array.from(this.modules.values());
  }
}
