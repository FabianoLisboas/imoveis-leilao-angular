import * as dotenv from 'dotenv';
dotenv.config();

export const environment = {
  production: false,
  apiUrl: '/api',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '', // Chave do Google Maps via variável de ambiente
}; 