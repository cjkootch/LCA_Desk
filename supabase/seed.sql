-- Seed: Guyana jurisdiction
insert into jurisdictions (code, name, full_name, regulatory_body, regulatory_body_short,
  submission_email, submission_email_subject_format, currency_code, local_currency_code, active, phase)
values (
  'GY',
  'Guyana',
  'Co-operative Republic of Guyana',
  'Local Content Secretariat, Ministry of Natural Resources',
  'LCS',
  'localcontent@nre.gov.gy',
  'Local Content Half-Yearly Report – {period} – {company_name}',
  'USD',
  'GYD',
  true,
  1
);

-- Seed: All 40 Guyana LCA sector categories (First Schedule)
insert into sector_categories (jurisdiction_id, code, name, min_local_content_pct, reserved, sort_order)
select
  (select id from jurisdictions where code = 'GY'),
  code, name, min_pct, true, sort_order
from (values
  ('CAT_01', 'Rental of Office Space', 90, 1),
  ('CAT_02', 'Accommodation Services (Apartments and Houses)', 90, 2),
  ('CAT_03', 'Equipment Rental (Crane and Other Heavy-Duty Machinery)', 50, 3),
  ('CAT_04', 'Surveying', 40, 4),
  ('CAT_05', 'Pipe Welding – Onshore', 30, 5),
  ('CAT_06', 'Pipe Sand Blasting and Coating – Onshore', 30, 6),
  ('CAT_07', 'Construction Work for Buildings Onshore', 60, 7),
  ('CAT_08', 'Structural Fabrication', 40, 8),
  ('CAT_09', 'Waste Management – Non-Hazardous', 60, 9),
  ('CAT_10', 'Waste Management – Hazardous', 25, 10),
  ('CAT_11', 'Storage Services (Warehousing)', 60, 11),
  ('CAT_12', 'Janitorial and Laundry Services', 80, 12),
  ('CAT_13', 'Catering Services', 90, 13),
  ('CAT_14', 'Food Supply', 80, 14),
  ('CAT_15', 'Administrative Support and Facilities Management', 70, 15),
  ('CAT_16', 'Immigration Support Services', 100, 16),
  ('CAT_17', 'Work Permit and Visa Applications', 80, 17),
  ('CAT_18', 'Laydown Yard Facilities', 70, 18),
  ('CAT_19', 'Customs Brokerage Services', 80, 19),
  ('CAT_20', 'Export Packaging, Crating, Preservation and Inspection', 50, 20),
  ('CAT_21', 'Pest Control Exterminator Services', 80, 21),
  ('CAT_22', 'Cargo Management and Monitoring', 60, 22),
  ('CAT_23', 'Ship and Rig Chandlery Services', 60, 23),
  ('CAT_24', 'Borehole Testing Services', 20, 24),
  ('CAT_25', 'Environmental Services and Studies', 40, 25),
  ('CAT_26', 'Transportation Services – Trucking and Movement of Personnel', 70, 26),
  ('CAT_27', 'Metrology Services', 40, 27),
  ('CAT_28', 'Ventilation (Private, Commercial, Industrial)', 40, 28),
  ('CAT_29', 'Industrial Cleaning Services (Onshore)', 70, 29),
  ('CAT_30', 'Security Services', 80, 30),
  ('CAT_31', 'ICT – Network Installation and Support Services', 50, 31),
  ('CAT_32', 'Manpower and Crewing Services', 60, 32),
  ('CAT_33', 'Dredging Services', 10, 33),
  ('CAT_34', 'Local Insurance Services', 80, 34),
  ('CAT_35', 'Local Accounting Services', 70, 35),
  ('CAT_36', 'Local Legal Services', 80, 36),
  ('CAT_37', 'Medical Services', 80, 37),
  ('CAT_38', 'Aviation Support Services', 20, 38),
  ('CAT_39', 'Engineering and Machining', 5, 39),
  ('CAT_40', 'Local Marketing and Advertising Services', 80, 40)
) as t(code, name, min_pct, sort_order);

-- Seed: Suriname (inactive, Phase 2)
insert into jurisdictions (code, name, active, phase)
values ('SR', 'Suriname', false, 2);

-- Seed: Namibia (inactive, Phase 3)
insert into jurisdictions (code, name, active, phase)
values ('NA', 'Namibia', false, 3);
