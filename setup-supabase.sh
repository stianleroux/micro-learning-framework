#!/bin/bash

# =====================================================
# Supabase Local Setup Script for Unix/Linux/macOS
# =====================================================

set -e  # Exit on error

echo "========================================"
echo "  Micro Learning Framework Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    echo "Visit: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

success "Prerequisites check passed!"
echo ""

# Install Supabase CLI
info "Installing Supabase CLI..."

# Check if supabase CLI is already installed
if command -v supabase &> /dev/null; then
    warning "Supabase CLI already installed. Updating..."
    npm update -g supabase
else
    npm install -g supabase
fi

success "Supabase CLI installed!"
echo ""

# Initialize Supabase project
info "Initializing Supabase project..."

if [ ! -d "supabase" ]; then
    supabase init
    success "Supabase project initialized!"
else
    info "Supabase project already initialized."
fi
echo ""

# Create .env.local template if it doesn't exist
info "Setting up environment configuration..."
ENV_FILE="micro-learning-app/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    mkdir -p "$(dirname "$ENV_FILE")"
    cat > "$ENV_FILE" << 'EOF'
# Local Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_anon_key_here

# Development Settings
NODE_ENV=development
VITE_APP_ENV=local

# Optional: Custom Database URL for direct connections
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
EOF
    success "Environment file created: $ENV_FILE"
else
    info "Environment file already exists: $ENV_FILE"
fi
echo ""

# Start Supabase local development
info "Starting Supabase local development..."
info "This will start PostgreSQL, GoTrue, Realtime, and other services..."
echo ""

# Start services in background
supabase start

# Wait for services to be ready
info "Waiting for services to start..."
sleep 10

# Get the anon key and update env file
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}' || echo "")
if [ ! -z "$ANON_KEY" ] && [ -f "$ENV_FILE" ]; then
    # Update the anon key in the env file
    sed -i.bak "s/your_anon_key_here/$ANON_KEY/" "$ENV_FILE" 2>/dev/null || \
    sed -i "s/your_anon_key_here/$ANON_KEY/" "$ENV_FILE" 2>/dev/null
    success "Updated environment file with anon key!"
fi

# Run database migrations
info "Running database migrations..."

if ls migrations/*.sql 1> /dev/null 2>&1; then
    info "Found migration files. Applying migrations..."
    for migration in migrations/*.sql; do
        info "Running migration: $(basename "$migration")"
        supabase db reset
    done
    success "Migrations completed!"
elif [ -f "supabase-schema.sql" ]; then
    info "No migrations found. Creating initial schema from supabase-schema.sql..."
    supabase db reset
    success "Initial schema created!"
else
    warning "No schema or migrations found. Database is empty."
fi
echo ""

# Display connection information
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Local Supabase is now running:"
echo "  - API URL: http://localhost:54321"
echo "  - Database URL: postgresql://postgres:postgres@localhost:54322/postgres"
echo "  - Studio URL: http://localhost:54323"
echo "  - Inbucket URL: http://localhost:54324"
echo ""

# Show current status
info "Current Supabase Status:"
supabase status
echo ""

echo "Environment Configuration:"
echo "  ✓ Environment file: $ENV_FILE"
echo "  ✓ Supabase URL: http://localhost:54321"
if [ ! -z "$ANON_KEY" ]; then
    echo "  ✓ Anon Key: $ANON_KEY"
fi
echo ""

echo "Next Steps:"
echo "  1. Navigate to micro-learning-app/ directory:"
echo "     cd micro-learning-app/"
echo "  2. Install dependencies:"
echo "     npm install"
echo "  3. Start development server:"
echo "     npm start"
echo ""

echo "Useful Commands:"
echo "  - Stop Supabase: supabase stop"
echo "  - View status: supabase status"
echo "  - View logs: supabase logs"
echo "  - Reset database: supabase db reset"
echo ""

success "Setup completed successfully! 🚀"