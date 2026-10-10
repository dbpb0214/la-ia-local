// Fixed inputs for the dev harness. EN samples mimic document text; ES samples mimic user questions.
// Glossary terms (see glossary.seed.json), numbers, abbreviations and an OCR-style paragraph included.
export const SAMPLES = {
  en: [
    'The tenant must pay a security deposit of $1,500.00 before moving in.',
    'The lease begins on March 1, 2025 and ends on February 28, 2026.',
    'Your landlord cannot raise the rent more than 5% per year.',
    'Rent is due on the 1st of each month; a late fee of $75 applies after the 5th.',
    'Dr. Ramirez from the U.S. Department of Housing will review the case.',
    'Bring a photo ID, e.g. a passport or driver’s license, to the appointment.',
    'If you do not have a Social Security Number, you may apply for an ITIN.',
    'Children under 19 may qualify for Medicaid regardless of the parents’ income.',
    'Call 311 or (212) 555-0147 between 9:00 a.m. and 5:00 p.m., Mon.–Fri.',
    'The landlord must return the security deposit within 14 days after the lease ends.',
    'Do not sign the lease until you have read every page.',
    'Form W-2 shows your wages and the taxes withheld in 2024.',
    'Approx. 2.5 million households received assistance last year.',
    'Keep copies of all receipts, letters and emails from your landlord.',
    'Section 8 vouchers cover part of the rent for eligible families.',
    'You have the right to an interpreter at no cost.',
    'The hearing is scheduled for 10/15/2025 at 9:30 AM in Room 4B.',
    // OCR-style: hard line breaks mid-sentence, end-of-line hyphenation, extra spaces, paragraph break.
    'NOTICE TO TENANT\n\nThis notice is to inform you that your security de-\nposit will be applied to the unpaid  rent\nfor the month of September. If you disagree, contact\nthe management office within 10 days.\n\nSincerely,\nGreenview Property Management',
  ],
  es: [
    '¿Mi arrendador puede quedarse con el depósito de garantía?',
    '¿Qué pasa si no firmo el contrato de arrendamiento?',
    '¿Cuánto tiempo tiene el arrendador para devolver mi dinero?',
    '¿Necesito un número de Seguro Social para pedir Medicaid?',
    '¿Puedo pagar la renta el día 5 sin multa?',
  ],
};
