#!/usr/bin/env bash
# Regenera las migraciones desde cero (solo antes del primer deploy).
# drizzle-kit comilla el tipo geography; lo corregimos acá.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf migrations
npx drizzle-kit generate --custom --name postgis >/dev/null
echo "CREATE EXTENSION IF NOT EXISTS postgis;" > migrations/0000_postgis.sql
npx drizzle-kit generate --name core >/dev/null
sed -i.bak 's/"geography(Polygon, 4326)"/geography(Polygon, 4326)/' migrations/0001_core.sql && rm migrations/0001_core.sql.bak
npx drizzle-kit generate --custom --name audit_immutable >/dev/null
cat > migrations/0002_audit_immutable.sql <<'SQL'
-- La auditoría es inmutable: solo se permiten inserciones.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es inmutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
SQL
ls migrations
# Desde acá las migraciones son incrementales (0003+): no regenerar más desde cero.
