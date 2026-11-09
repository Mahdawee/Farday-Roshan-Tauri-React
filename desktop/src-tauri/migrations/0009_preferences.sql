-- Calendar display is a local preference, not a fiscal-year setting.
CREATE TABLE app_preferences (
    id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
    calendar TEXT NOT NULL CHECK(calendar IN ('shamsi','miladi'))
);
INSERT INTO app_preferences(id, calendar) VALUES(1, 'shamsi');
