// api/generate.js

require('dotenv').config();
const axios = require('axios');

// Middleware CORS (sin cambios)
const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  // CAMBIAR '*' por tu dominio de Vercel en producción para más seguridad
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// Handler principal de la API
const handler = async (req, res) => {
  console.log(`[${new Date().toISOString()}] Received request: ${req.method} ${req.url}`); // Log de recepción

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.warn("Method Not Allowed:", req.method);
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) { // Validación más estricta
    console.warn("Bad Request: Prompt inválido o ausente.");
    return res.status(400).json({ error: 'El campo "prompt" es requerido y debe ser texto no vacío.' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('FATAL: GOOGLE_API_KEY no está configurada en las variables de entorno.');
    return res.status(500).json({ error: 'Error interno de configuración del servidor.' });
  }
   // console.log("Using GOOGLE_API_KEY: ", apiKey ? '*** (presente)' : '!!! AUSENTE !!!'); // Log más seguro

  // URL de la API (puedes cambiar el modelo si lo deseas)
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  console.log(`Attempting to call Google API for prompt: "${prompt.substring(0, 50)}..."`);

  try {
    const googleResponse = await axios.post(
      apiUrl,
      {
        contents: [{ parts: [{ text: prompt }] }],
        // Puedes añadir configuraciones aquí: generationConfig, safetySettings, etc.
        // generationConfig: { temperature: 0.7 }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log("Google API call successful. Status:", googleResponse.status);
    // Añade validación básica de la respuesta de Google antes de enviarla
    if (!googleResponse.data || !googleResponse.data.candidates) {
         console.warn("Respuesta de Google inesperada o vacía:", googleResponse.data);
         throw new Error("Formato de respuesta inesperado de la API de Google.");
    }

    return res.status(200).json(googleResponse.data);

  } catch (error) {
    console.error('Error calling Google API:');
    if (error.response) {
      // El servidor respondió con un estado fuera del rango 2xx
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error?.message || 'Error desconocido desde la API de Google.';
      return res.status(statusCode).json({ error: `Error ${statusCode}: ${errorMessage}` });
    } else if (error.request) {
      // La petición se hizo pero no se recibió respuesta
      console.error('No response received:', error.request);
      return res.status(503).json({ error: 'No se recibió respuesta del servicio de IA. Intenta de nuevo más tarde.' });
    } else {
      // Error al configurar la petición
      console.error('Error setting up request:', error.message);
      return res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
    }
  }
};

// Exporta el handler envuelto en el middleware CORS
module.exports = allowCors(handler);