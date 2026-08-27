#!/bin/bash
set -e

CONF="/etc/postgresql/16/main/postgresql.conf"
HBA="/etc/postgresql/16/main/pg_hba.conf"

echo "Configuring listen_addresses = '*' in $CONF..."
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONF"
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONF"

echo "Configuring pg_hba.conf in $HBA..."
grep -q "0.0.0.0/0" "$HBA" || echo "host all all 0.0.0.0/0 scram-sha-256" >> "$HBA"
grep -q "::0/0" "$HBA" || echo "host all all ::0/0 scram-sha-256" >> "$HBA"

echo "Restarting PostgreSQL..."
service postgresql restart
service postgresql status

echo "Configuration completed!"
