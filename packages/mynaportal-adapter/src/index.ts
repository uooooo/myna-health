import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface DispensingEntry {
  drugCode: string;
  drugName: string;
  dispensedAt: string;
  epochDay: number;
  institutionName: string;
  institutionCode: string;
}

export interface ImportedMedicalRecord {
  format: 'YZK-IF-002';
  provenance: 'unverified-user-import';
  patientName: string;
  entries: DispensingEntry[];
}

function many(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry),
  );
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Missing ${label}`);
  return value as Record<string, unknown>;
}

function value(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input).trim() : '';
}

function parseDay(raw: string): { iso: string; epochDay: number } {
  if (!/^\d{8}$/.test(raw)) throw new Error('DiDate must use YYYYMMDD');
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== iso) throw new Error('Invalid DiDate');
  return { iso, epochDay: Math.floor(ms / 86400000) };
}

/** Parses the MHLW YZK-IF-002 medication XML layout entirely in the caller's process.
 *  XML possession does not authenticate the origin; the result MUST NOT be issued as a credential.
 */
export function parseMedicationXml(xml: string): ImportedMedicalRecord {
  if (typeof xml !== 'string' || xml.length === 0 || xml.length > 2_000_000) throw new Error('XML must be between 1 byte and 2 MB');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('DTD and entities are not allowed');
  if (XMLValidator.validate(xml) !== true) throw new Error('Malformed XML');
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false,
    processEntities: false, trimValues: true }).parse(xml) as Record<string, unknown>;
  const message = object(parsed.Message, 'Message');
  const header = object(message.MessageHeader, 'MessageHeader');
  const qualifications = object(header.QualificationsInfo, 'QualificationsInfo');
  const body = object(message.MessageBody, 'MessageBody');
  const patientName = value(qualifications.Name);
  if (!patientName) throw new Error('Missing QualificationsInfo/Name');
  const entries: DispensingEntry[] = [];
  for (const month of many(body.MeTrMonthInf)) {
    const institutionName = value(month.MedicalInstitutionName);
    const institutionCode = value(month.MedicalInstitutionCode);
    for (const day of many(object(month.DiDateInfs, 'DiDateInfs').DiDateInf)) {
      const { iso, epochDay } = parseDay(value(day.DiDate));
      for (const drug of many(object(day.DrugInfs, 'DrugInfs').DrugInf)) {
        const drugCode = value(drug.DrugC);
        if (!/^\d{9}$/.test(drugCode)) throw new Error('DrugC must be a 9-digit code');
        entries.push({ drugCode, drugName: value(drug.DrugN), dispensedAt: iso, epochDay,
          institutionName, institutionCode });
      }
    }
  }
  if (!entries.length) throw new Error('No dispensing entries in YZK-IF-002 XML');
  return { format: 'YZK-IF-002', provenance: 'unverified-user-import', patientName, entries };
}
