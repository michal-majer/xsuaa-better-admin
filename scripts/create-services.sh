#!/bin/bash

set -e

echo "Creating XSUAA service instance..."
cf create-service xsuaa application xsuaa-pg-nextjs-xsuaa -c xs-security.json

echo "Creating PostgreSQL service instance..."
cf create-service postgresql-db trial xsuaa-pg-nextjs-postgres

echo "Waiting for services to be created..."
sleep 30

echo "Verifying services..."
cf services

echo "Services created successfully!"
