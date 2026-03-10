// Public data APIs called directly from frontend (fallback when Worker is unavailable)
const API_KEY = import.meta.env.VITE_PUBLIC_DATA_API_KEY ?? '';

export async function getPropertyPriceDirect(_address: string, _type: string, _area: number) {
  if (!API_KEY) return null;
  try {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcLandPrice/getRTMSDataSvcLandPrice?serviceKey=${API_KEY}&LAWD_CD=11110&DEAL_YMD=202601&pageNo=1&numOfRows=10&type=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getVehicleValueDirect(_plate: string) {
  // Vehicle lookup is handled by the Worker with internal DB
  // Direct API call not available
  return null;
}
