/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client for the SmartOffice Biometrics & HRMS API (see
 * SmartOfficeAPIDocumentation.pdf, "Fetch Biometric Logs Data" — GET
 * /api/v2/WebAPI/GetDeviceLogs). Requires SMARTOFFICE_BASE_URL and
 * SMARTOFFICE_API_KEY, both account-specific and not yet configured for
 * this institute — every call fails fast with a clear message until they
 * are set in the environment.
 */

export interface SmartOfficePunchLog {
  EmployeeCode: string;
  LogDate: string; // "YYYY-MM-DD HH:mm:ss"
  SerialNumber: string;
  PunchDirection?: string;
  Temperature?: number;
  TemperatureState?: string;
}

function getConfig() {
  const baseUrl = process.env.SMARTOFFICE_BASE_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.SMARTOFFICE_API_KEY?.trim();
  return { baseUrl, apiKey };
}

export function isSmartOfficeConfigured(): boolean {
  const { baseUrl, apiKey } = getConfig();
  return Boolean(baseUrl && apiKey);
}

/**
 * Fetch raw punch logs for a date range (format: YYYY-MM-DD, matches the
 * documented FromDate/ToDate params).
 */
export async function fetchSmartOfficeDeviceLogs(fromDate: string, toDate: string): Promise<SmartOfficePunchLog[]> {
  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl || !apiKey) {
    throw new Error(
      'SmartOffice is not configured. Set SMARTOFFICE_BASE_URL and SMARTOFFICE_API_KEY in the environment.'
    );
  }

  const url = `${baseUrl}/api/v2/WebAPI/GetDeviceLogs?APIKey=${encodeURIComponent(apiKey)}&FromDate=${encodeURIComponent(fromDate)}&ToDate=${encodeURIComponent(toDate)}`;
  const response = await fetch(url);
  const data: any = await response.json().catch(() => null);

  // Documented error shape: { status: false, message: "..." }
  if (data && typeof data === 'object' && !Array.isArray(data) && data.status === false) {
    throw new Error(data.message || 'SmartOffice API returned an error');
  }
  if (!response.ok) {
    throw new Error(`SmartOffice API request failed with status ${response.status}`);
  }
  if (!Array.isArray(data)) {
    throw new Error('Unexpected SmartOffice API response shape');
  }

  return data as SmartOfficePunchLog[];
}
