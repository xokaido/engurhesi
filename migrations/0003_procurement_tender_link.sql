-- Link procurement notices to the state procurement portal (tenders.procurement.gov.ge)
ALTER TABLE procurements ADD COLUMN tender_number text;
ALTER TABLE procurements ADD COLUMN tender_url text;
