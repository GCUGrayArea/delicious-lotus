#!/bin/bash
#
# AWS Deployment Script
# Deploys/updates the entire AI Video Generation Pipeline infrastructure
#
# Usage:
#   ./scripts/deploy.sh [init|plan|apply|destroy]
#
# Commands:
#   init     - Initialize Terraform (run once or when adding providers)
#   plan     - Preview changes without applying them
#   apply    - Apply infrastructure changes (builds and deploys everything)
#   destroy  - Destroy all AWS resources (WARNING: DESTRUCTIVE)
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        exit 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi

    # Check Node.js and npm (needed for frontend build)
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install it first."
        exit 1
    fi

    # Check terraform.tfvars exists
    if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
        log_error "terraform.tfvars not found. Please copy terraform.tfvars.example and fill in your values."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure'."
        exit 1
    fi

    log_info "All prerequisites satisfied ✓"
}

load_env_vars() {
    log_info "Loading environment variables..."
    
    # Helper function to source only valid variable assignments
    # This avoids errors from comments or documentation in .env files
    source_env_file() {
        local file="$1"
        if [ -f "$file" ]; then
            log_info "Loading variables from $file..."
            set -a # Automatically export all sourced variables
            
            # 1. Use grep to find only lines starting with VALID_VAR_NAME=
            # 2. Use source /dev/stdin to load them into the current shell
            # This handles quotes and spaces correctly, unlike xargs
            grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" | source /dev/stdin
            
            set +a
        fi
    }

    source_env_file "$PROJECT_ROOT/.env"
    source_env_file "$PROJECT_ROOT/backend-api/.env"

    # Export specific variables for Terraform if they exist in env
    if [ -n "$OPENAI_API_KEY" ]; then
        export TF_VAR_openai_api_key="$OPENAI_API_KEY"
        log_info "Exported OPENAI_API_KEY for Terraform"
    fi

    if [ -n "$REPLICATE_API_TOKEN" ]; then
        export TF_VAR_replicate_api_token="$REPLICATE_API_TOKEN"
        log_info "Exported REPLICATE_API_TOKEN for Terraform"
    fi
}

build_frontend() {
    log_info "Building frontend application..."
    cd "$PROJECT_ROOT/frontend-app"

    # Check if node_modules exists, if not run npm install
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    # Build the frontend
    log_info "Building frontend dist files..."
    npm run build

    # Verify dist directory was created
    if [ ! -d "dist" ]; then
        log_error "Frontend build failed - dist directory not created"
        exit 1
    fi

    log_info "Frontend built successfully ✓"
}

build_backend_image() {
    log_info "Building backend Docker image..."
    cd "$PROJECT_ROOT"
    docker build -t backend-api:latest -f backend-api/Dockerfile .
    log_info "Backend image built successfully ✓"
}

terraform_init() {
    log_info "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    terraform init
    log_info "Terraform initialized ✓"
}

terraform_plan() {
    log_info "Creating Terraform plan..."
    cd "$TERRAFORM_DIR"
    terraform plan -out=tfplan
    log_info "Plan created. Review above before applying."
}

terraform_apply() {
    log_info "Applying Terraform configuration..."
    cd "$TERRAFORM_DIR"

    if [ -f tfplan ]; then
        terraform apply tfplan
        rm tfplan
    else
        terraform apply -auto-approve
    fi

    log_info "Infrastructure deployed successfully ✓"
}

push_to_ecr() {
    log_info "Pushing Docker image to ECR..."
    cd "$TERRAFORM_DIR"

    # Get ECR repository URL from Terraform output
    ECR_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")

    if [ -z "$ECR_URL" ]; then
        log_error "Could not get ECR URL from Terraform. Has infrastructure been deployed?"
        exit 1
    fi

    # Get AWS region from terraform
    AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-2")

    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$ECR_URL"

    # Tag and push image
    log_info "Tagging image..."
    docker tag backend-api:latest "$ECR_URL:latest"

    log_info "Pushing to ECR (this may take a few minutes)..."
    docker push "$ECR_URL:latest"

    log_info "Image pushed to ECR successfully ✓"
}

update_ecs_service() {
    log_info "Updating ECS service to use new image..."
    cd "$TERRAFORM_DIR"

    CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "ai-video-cluster")
    SERVICE_NAME=$(terraform output -raw ecs_service_name 2>/dev/null || echo "backend-api-service")
    AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-2")

    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --force-new-deployment \
        --region "$AWS_REGION" \
        > /dev/null

    log_info "ECS service updated. New tasks will be deployed automatically ✓"
}

show_outputs() {
    log_info "Deployment outputs:"
    cd "$TERRAFORM_DIR"
    terraform output
}

terraform_destroy() {
    log_warn "⚠️  WARNING: This will destroy ALL AWS resources!"
    log_warn "⚠️  Database, S3 data, and all infrastructure will be deleted!"
    echo ""
    read -p "Type 'yes' to confirm destruction: " confirmation

    if [ "$confirmation" != "yes" ]; then
        log_info "Destruction cancelled."
        exit 0
    fi

    log_info "Destroying infrastructure..."
    cd "$TERRAFORM_DIR"
    terraform destroy -auto-approve
    log_info "Infrastructure destroyed."
}

full_deployment() {
    check_prerequisites
    load_env_vars
    build_frontend
    build_backend_image
    terraform_apply
    push_to_ecr
    update_ecs_service
    show_outputs

    echo ""
    log_info "========================================="
    log_info "Deployment Complete!"
    log_info "========================================="
    log_info "Your infrastructure is now running."
    log_info "Check the outputs above for connection details."
}

# Main script logic
COMMAND=${1:-apply}

case "$COMMAND" in
    init)
        check_prerequisites
        terraform_init
        ;;
    plan)
        check_prerequisites
        terraform_plan
        ;;
    apply)
        full_deployment
        ;;
    destroy)
        check_prerequisites
        terraform_destroy
        ;;
    *)
        echo "Usage: $0 [init|plan|apply|destroy]"
        echo ""
        echo "Commands:"
        echo "  init     - Initialize Terraform (run once)"
        echo "  plan     - Preview changes without applying"
        echo "  apply    - Deploy/update everything (default)"
        echo "  destroy  - Destroy all AWS resources (DANGEROUS)"
        exit 1
esac
