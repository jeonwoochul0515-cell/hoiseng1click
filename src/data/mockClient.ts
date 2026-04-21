/**
 * 시연·데모용 가상 의뢰인.
 * 실데이터 연결 전까지 문서 중심 UX를 구현하고 시연하기 위한 fixture.
 */
export const MOCK_CLIENT = {
  name: '홍길동',
  ssnMasked: '880101-1******',
  phone: '010-1234-5678',
  address: '서울특별시 강남구 테헤란로 123, 101동 1203호',
  residentAddress: '서울특별시 강남구 테헤란로 123, 101동 1203호',
  familyCount: 3,
  job: '사무직',
  companyName: '(주)가나다',
  court: '서울회생법원',
  monthlyIncome: 3200000,
  livingExpense: 2200000,
  rent: 600000,
  education: 0,
  medical: 50000,

  debts: [
    { creditor: '국민은행', type: '무담보', amount: 28500000, rate: 6.8, monthly: 520000 },
    { creditor: '신한은행', type: '무담보', amount: 15200000, rate: 7.2, monthly: 310000 },
    { creditor: '카카오뱅크', type: '무담보', amount: 9800000, rate: 9.5, monthly: 220000 },
    { creditor: '삼성카드 카드론', type: '무담보', amount: 6500000, rate: 14.9, monthly: 180000 },
    { creditor: '롯데카드 현금서비스', type: '무담보', amount: 2300000, rate: 19.5, monthly: 95000 },
  ],

  assets: [
    { name: '국민은행 예금', type: '예금', value: 1850000 },
    { name: '신한은행 적금', type: '예금', value: 3200000 },
    { name: '삼성생명 종신보험 해지환급금', type: '보험', value: 5400000 },
    { name: '소나타 2020년식', type: '차량', value: 9800000 },
  ],

  family: [
    { relation: '배우자', name: '김영희', birth: '1990-05-20' },
    { relation: '자녀', name: '홍서연', birth: '2018-03-15' },
  ],
};

export type MockClient = typeof MOCK_CLIENT;
