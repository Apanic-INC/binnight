const API_URL = 'https://binnight-api.onrender.com';
const BN_API_KEY = 'a112fbd00fb1ea7a31c5e30d954a39b89e61e651962123b72d7b3b4ec786423e';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${BN_API_KEY}`,
    ...options.headers,
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}
