-- PostgreSQL-Initialisierung
-- Wird einmalig beim ersten Start ausgeführt

-- Erweiterungen aktivieren
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RLS-Unterstützung sicherstellen
-- (PostgreSQL 16 hat RLS nativ, keine Extension nötig)
