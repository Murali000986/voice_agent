/** Reads a fetch Response body as JSON, handling empty or non-JSON bodies gracefully. */
export async function readApiResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  if (!body.trim()) {
    if (!response.ok) throw new Error(`Server returned an empty response (${response.status}). Is the backend running?`);
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    if (!response.ok) throw new Error(`Server error (${response.status}). Try again in a moment.`);
    throw new Error('The server returned an unreadable response. Check that the backend is running.');
  }
}
