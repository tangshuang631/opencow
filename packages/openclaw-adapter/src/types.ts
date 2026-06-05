export interface OpenClawMetadata {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly repositoryUrl: string;
}

export interface OpenClawCapability {
  readonly available: boolean;
  readonly packageName: string;
  readonly packagePath: string;
}

export interface OpenClawCapabilities {
  readonly llmCore: OpenClawCapability;
  readonly llmRuntime: OpenClawCapability;
  readonly modelCatalog: OpenClawCapability;
  readonly pluginSdk: OpenClawCapability;
  readonly terminalCore: OpenClawCapability;
  readonly toolCallRepair: OpenClawCapability;
}
