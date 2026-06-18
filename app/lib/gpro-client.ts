// app/lib/gpro-client.ts

import { endpoints } from './gpro-api';

export interface GproClientOptions {
  token: string;
  endpoint: string;
  params?: Record<string, string>;
}

export async function fetchGproEndpoint(options: GproClientOptions): Promise<any> {
  const { token, endpoint, params } = options;

  // Validar endpoint
  if (!endpoints.includes(endpoint)) {
    throw new Error(`Endpoint inválido: ${endpoint}`);
  }

  // Construir URL
  const url = new URL(`https://api.gpro.net/gpro/${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Fazer requisição
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const response = await fetch(url.toString(), { headers });

  // Tratar resposta
  if (!response.ok) {
    const errorText = await response.text();
    
    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }

    throw new Error(errorMessage);
  }

  return response.json();
}