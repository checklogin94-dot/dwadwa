// EYO Wallet Integration Service (REAL PIX GATEWAY)
// Documentação: https://docs.eyowallet.ru/
// Base URL: https://api.eyowallet.ru/api/v1

import { PixKeyType } from '../types';

const CORS_PROXY = 'https://corsproxy.io/?'; 
const EYO_API_URL = 'https://api.eyowallet.ru/api/v1';
const API_KEY = 'eyo_xep9k88exgsj';

interface EyoResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaymentData {
  id: string;
  transactionId?: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  value: number; 
  qrcodeUrl?: string;
  copyPaste?: string;
}

export interface WithdrawData {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

// Fallback helper caso o tipo não seja passado (compatibilidade)
const detectPixKeyType = (key: string): PixKeyType => {
  const cleanKey = key.trim();
  if (cleanKey.includes('@')) return 'EMAIL';
  const digits = cleanKey.replace(/\D/g, '');
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  if (cleanKey.startsWith('+') || (digits.length > 11 && digits.length <= 14)) return 'PHONE';
  return 'RANDOM';
};

export const eyoService = {
  /**
   * 1. Criar Pagamento REAL (Gera Pix)
   * Endpoint: POST /payment/create
   */
  createPayment: async (
    value: number, 
    description: string
  ): Promise<EyoResponse<PaymentData>> => {
    try {
      // Proxy + Endpoint
      const url = `${CORS_PROXY}${EYO_API_URL}/payment/create`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          value: value, // API usa 'value' (float)
          description: description,
          coverFee: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro API EYO (${response.status}): ${errorText}`);
      }

      const resJson = await response.json();
      
      if (!resJson.success || !resJson.data) {
        throw new Error(resJson.message || 'Falha ao criar pagamento.');
      }

      return { 
        success: true, 
        data: {
            id: resJson.data.id,
            transactionId: resJson.data.transactionId,
            status: resJson.data.status,
            value: resJson.data.valueInReais || value,
            qrcodeUrl: resJson.data.qrcodeUrl,
            copyPaste: resJson.data.copyPaste
        }
      };

    } catch (e: any) {
      console.error('EYO Payment Error:', e);
      return { success: false, error: e.message || 'Falha ao criar cobrança Pix.' };
    }
  },

  /**
   * 2. Consultar Status do Pagamento
   * Endpoint: GET /payment/get/{id}
   */
  getPaymentStatus: async (paymentId: string): Promise<EyoResponse<PaymentData>> => {
    try {
      const url = `${CORS_PROXY}${EYO_API_URL}/payment/get/${paymentId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`Erro API Status (${response.status})`);
      }
      
      const resJson = await response.json();
      
      if (!resJson.success) {
          throw new Error(resJson.message);
      }

      return { 
          success: true, 
          data: {
              id: resJson.data.id,
              status: resJson.data.status,
              value: resJson.data.value || 0,
              qrcodeUrl: resJson.data.qrCode,
              copyPaste: undefined 
          } 
      };

    } catch (e: any) {
      console.error('EYO Status Check Error:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * 3. Criar Saque REAL (Withdraw)
   * Endpoint: POST /withdraw/create
   */
  createWithdraw: async (amount: number, pixKey: string, explicitType?: PixKeyType): Promise<EyoResponse<WithdrawData>> => {
    try {
      // Líquido Vendedor = 95% (Taxa de 5%)
      const sellerAmount = Number((amount * 0.95).toFixed(2));
      
      // Usa o tipo explícito se fornecido, senão tenta detectar
      const keyType = explicitType || detectPixKeyType(pixKey);

      const url = `${CORS_PROXY}${EYO_API_URL}/withdraw/create`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          amount: sellerAmount,
          pixKey: pixKey,
          pixKeyType: keyType, 
          description: "Repasse Nexus Market",
          coverFee: true 
        }),
      });

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`Erro no Saque (${response.status}): ${errorText}`);
      }
      
      const resJson = await response.json();
      
      if (!resJson.success) throw new Error(resJson.message);

      return { 
          success: true, 
          data: {
              id: resJson.data.id,
              status: resJson.data.status
          }
      };

    } catch (e: any) {
      console.error('EYO Withdraw Error:', e);
      return { success: false, error: e.message || 'Falha ao realizar repasse financeiro.' };
    }
  }
};