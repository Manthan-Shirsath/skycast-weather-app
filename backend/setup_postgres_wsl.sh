#!/bin/bash
set -e
echo "1. Installing PostgreSQL..."
apt-get update -qq
apt-get install -y -qq postgresql postgresql-contrib

echo "2. Starting PostgreSQL service..."
service postgresql start

echo "3. Configuring postgres user and database..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'skycast_weather'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE skycast_weather;"

echo "4. Checking PostgreSQL status..."
service postgresql status
echo "PostgreSQL setup complete!"
