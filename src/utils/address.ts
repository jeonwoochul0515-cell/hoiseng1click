declare global {
  interface Window {
    daum: {
      Postcode: new (opts: {
        oncomplete: (data: DaumPostcodeResult) => void;
        onclose?: () => void;
        width?: string | number;
        height?: string | number;
      }) => { open: () => void; embed: (el: HTMLElement) => void };
    };
  }
}

export interface DaumPostcodeResult {
  zonecode: string;       // 우편번호
  roadAddress: string;    // 도로명주소
  jibunAddress: string;   // 지번주소
  buildingName: string;   // 건물명
  apartment: string;      // 아파트 여부 (Y/N)
  sido: string;           // 시도
  sigungu: string;        // 시군구
  bname: string;          // 법정동/법정리
  roadname: string;       // 도로명
}

/**
 * 다음 우편번호 서비스를 팝업으로 열어 도로명주소를 선택하게 한다.
 * 선택 완료 시 resolve, 닫으면 빈 문자열로 resolve.
 */
export interface AddressSearchResult {
  address: string;
  zonecode: string;
  sido: string;
  sigungu: string;
}

export function openAddressSearch(): Promise<AddressSearchResult | null> {
  return new Promise((resolve) => {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
      resolve(null);
      return;
    }

    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeResult) {
        const detail = data.buildingName ? ` (${data.buildingName})` : '';
        resolve({
          address: data.roadAddress + detail,
          zonecode: data.zonecode,
          sido: data.sido,
          sigungu: data.sigungu,
        });
      },
      onclose() {
        resolve(null);
      },
    }).open();
  });
}
