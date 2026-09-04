import { OllamaNativeProvider } from "./ollamaNativeProvider.js";

export type ModelGateway = {
  provider: "ollama-native";
  native: true;
  endpoint: string;
  ollama: OllamaNativeProvider;
  createRuntimeProfile(input: Parameters<OllamaNativeProvider["profileRuntime"]>[0]): ReturnType<OllamaNativeProvider["profileRuntime"]>;
};

export function createModelGateway(options: ConstructorParameters<typeof OllamaNativeProvider>[0] = {}): ModelGateway {
  const ollama = new OllamaNativeProvider(options);
  return {
    provider: "ollama-native",
    native: true,
    endpoint: ollama.endpoint,
    ollama,
    createRuntimeProfile: (input) => ollama.profileRuntime(input)
  };
}
