declare module 'axios' {
  export interface AxiosRequestConfig {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, any>;
    [key: string]: any;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status?: number;
    statusText?: string;
    headers?: Record<string, any>;
    config: AxiosRequestConfig;
  }

  export interface AxiosRequestHeaders {
    [key: string]: any;
  }

  export interface AxiosInstance {
    <T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: {
      request: {
        use(
          onFulfilled: (
            config: AxiosRequestConfig,
          ) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
        ): void;
      };
    };
    defaults: AxiosRequestConfig;
  }

  export function create(config?: AxiosRequestConfig): AxiosInstance;

  const axios: AxiosInstance & {create: typeof create};
  export default axios;
}
