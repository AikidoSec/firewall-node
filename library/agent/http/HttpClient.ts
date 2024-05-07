export interface HttpClient {
  request(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body: string,
    signal: AbortSignal
  ): Promise<{
    body: string;
    statusCode: number;
  }>;
}
