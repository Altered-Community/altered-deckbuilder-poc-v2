interface AlteredRenderOptions {
  configBaseUrl?: string;
  cardApiUrl?: string;
  proxyUrl?: string | false | null;
  useApiBackground?: boolean;
  embeddedConfig?: object | null;
  lang?: string;
}

interface AlteredRenderInstance {
  init(options?: AlteredRenderOptions): Promise<unknown>;
  mount(container: HTMLElement, cardJson: object, options?: AlteredRenderOptions): Promise<unknown>;
  mountFromApi(container: HTMLElement, apiJson: object, mapping?: object, options?: AlteredRenderOptions): Promise<unknown>;
}

interface Window {
  AlteredRender?: AlteredRenderInstance;
}
