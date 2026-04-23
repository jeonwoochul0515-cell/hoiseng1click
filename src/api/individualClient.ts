import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Client } from '@/types/client';

/**
 * individuals/{uid} 문서를 Client 타입으로 로드.
 * Individual 기본 필드(name, phone 등)는 Client 필드와 매핑.
 * debts/assets 등 Client 고유 필드는 Firestore 에 저장된 그대로 로드.
 */
export async function getIndividualAsClient(uid: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, 'individuals', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, any>;

  // Individual → Client 매핑 (누락 필드는 기본값)
  return {
    id: uid,
    name: data.name ?? '',
    ssn: data.ssn ?? '',
    ssnEncrypted: data.ssnEncrypted,
    ssnMasked: data.ssnMasked,
    phone: data.phone ?? '',
    address: data.address ?? '',
    zonecode: data.zonecode,
    job: data.job ?? '',
    jobType: data.jobType ?? 'employed',
    family: data.family ?? 0,
    court: data.court ?? '',
    income: data.income ?? 0,
    income2: data.income2 ?? 0,
    rent: data.rent ?? 0,
    education: data.education ?? 0,
    medical: data.medical ?? 0,
    status: data.status ?? 'new',
    collectionDone: data.collectionDone ?? false,
    connectedId: data.connectedId,
    debts: data.debts ?? [],
    assets: data.assets ?? [],
    memo: data.memo ?? '',
    intakeSubmissionId: data.intakeSubmissionId,
    fee: data.fee,
    feeInstallment: data.feeInstallment,
    feeInstallmentMonths: data.feeInstallmentMonths,
    feePaidAmount: data.feePaidAmount,
    createdAt: data.createdAt ?? Timestamp.now(),
    updatedAt: data.updatedAt ?? Timestamp.now(),
    // 선택 필드 (그대로 전달)
    caseNumber: data.caseNumber,
    filingDate: data.filingDate,
    debtReason: data.debtReason,
    repayPeriodMonths: data.repayPeriodMonths,
    food: data.food,
    transport: data.transport,
    telecom: data.telecom,
    insurancePremium: data.insurancePremium,
    familyMembers: data.familyMembers,
    selfEmployedIncome: data.selfEmployedIncome,
    leibniz: data.leibniz,
    priorityClaims: data.priorityClaims,
    statement: data.statement,
    incomeType: data.incomeType,
    repayStartDate: data.repayStartDate,
    repayStartAfterAuthorization: data.repayStartAfterAuthorization,
    repayDayOfMonth: data.repayDayOfMonth,
    monthlyPaymentOverride: data.monthlyPaymentOverride,
    refundBank: data.refundBank,
    refundAccount: data.refundAccount,
    refundAccountHolder: data.refundAccountHolder,
    nationality: data.nationality,
    nameForeign: data.nameForeign,
    residentAddress: data.residentAddress,
    residentAddressDetail: data.residentAddressDetail,
    residentZonecode: data.residentZonecode,
    actualAddress: data.actualAddress,
    actualAddressDetail: data.actualAddressDetail,
    actualZonecode: data.actualZonecode,
    sameAsResident: data.sameAsResident,
    deliveryAddress: data.deliveryAddress,
    deliveryAddressDetail: data.deliveryAddressDetail,
    deliveryZonecode: data.deliveryZonecode,
    sameDeliveryAsResident: data.sameDeliveryAsResident,
    tel: data.tel,
    fax: data.fax,
    email: data.email,
    docVisibility: data.docVisibility,
    relatedCases: data.relatedCases,
    applicationPurpose: data.applicationPurpose,
    applicationReason: data.applicationReason,
    activeCourtCases: data.activeCourtCases,
    taxInvoices: data.taxInvoices,
    taxDelinquency: data.taxDelinquency,
  } as Client;
}

/**
 * individuals/{uid} 문서의 일부 필드 업데이트 (Client 형식).
 * Client 의 id/createdAt/updatedAt 은 제외하고 쓰기.
 */
export async function updateIndividualClient(
  uid: string,
  data: Partial<Client>,
): Promise<void> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...writable } = data;
  void _id;
  void _createdAt;
  void _updatedAt;
  await updateDoc(doc(db, 'individuals', uid), {
    ...writable,
    updatedAt: Timestamp.now(),
  });
}
