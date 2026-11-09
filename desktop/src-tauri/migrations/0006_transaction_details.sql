-- Supplemental text has no effect on accounting. Existing documents remain valid without a row.
CREATE TABLE sale_details (
    sale_id TEXT PRIMARY KEY NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    bill_no TEXT NOT NULL DEFAULT '' CHECK(length(CAST(bill_no AS BLOB)) <= 160),
    driver_name TEXT NOT NULL DEFAULT '' CHECK(length(CAST(driver_name AS BLOB)) <= 320),
    vehicle_plate TEXT NOT NULL DEFAULT '' CHECK(length(CAST(vehicle_plate AS BLOB)) <= 160),
    destination TEXT NOT NULL DEFAULT '' CHECK(length(CAST(destination AS BLOB)) <= 320),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(CAST(notes AS BLOB)) <= 4000)
);
CREATE TABLE receipt_details (
    receipt_id TEXT PRIMARY KEY NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    related_bill_no TEXT NOT NULL DEFAULT '' CHECK(length(CAST(related_bill_no AS BLOB)) <= 160),
    received_by TEXT NOT NULL DEFAULT '' CHECK(length(CAST(received_by AS BLOB)) <= 320),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(CAST(notes AS BLOB)) <= 4000)
);
