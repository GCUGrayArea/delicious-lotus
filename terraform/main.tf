terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "AI Video Generation Pipeline"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data source to get default VPC
data "aws_vpc" "default" {
  default = true
}

# Data source to get default subnets in us-east-2
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Data source to get public subnets only (those with IGW routes)
# Hardcoded to use only subnets with verified Internet Gateway routes
# These were identified by checking route tables for igw-* gateways
locals {
  public_subnet_ids = [
    "subnet-05a3ecc69cc888d22",  # Public subnet with IGW route
    "subnet-0db85a5a039387dae",  # Public subnet with IGW route
  ]
}

# Data source for availability zones in us-east-2
data "aws_availability_zones" "available" {
  state = "available"
}

# ECR - Container Registry
module "ecr" {
  source = "./modules/ecr"

  repository_name = var.ecr_repository_name
  environment     = var.environment
}

# S3 - Storage Bucket
module "s3" {
  source = "./modules/s3"

  bucket_name = var.s3_bucket_name
  environment = var.environment
}

# IAM - Roles and Policies
module "iam" {
  source = "./modules/iam"

  s3_bucket_arn = module.s3.bucket_arn
  environment   = var.environment
}

# Security Groups
module "security" {
  source = "./modules/security"

  vpc_id      = data.aws_vpc.default.id
  environment = var.environment
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  project_name          = "ai-video"
  environment           = var.environment
  vpc_id                = data.aws_vpc.default.id
  subnet_ids            = local.public_subnet_ids
  alb_security_group_id = module.security.alb_security_group_id
  backend_port          = 8000
}

# RDS - PostgreSQL Database
module "rds" {
  source = "./modules/rds"

  identifier        = var.db_identifier
  database_name     = var.db_name
  master_username   = var.db_username
  master_password   = var.db_password
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage

  vpc_id            = data.aws_vpc.default.id
  subnet_ids        = data.aws_subnets.default.ids
  security_group_id = module.security.rds_security_group_id

  environment = var.environment
}

# ElastiCache - Redis
module "elasticache" {
  source = "./modules/elasticache"

  cluster_id      = var.redis_cluster_id
  node_type       = var.redis_node_type
  num_cache_nodes = var.redis_num_nodes

  vpc_id            = data.aws_vpc.default.id
  subnet_ids        = data.aws_subnets.default.ids
  security_group_id = module.security.redis_security_group_id

  environment = var.environment
}

# CloudWatch - Logging and Monitoring
module "cloudwatch" {
  source = "./modules/cloudwatch"

  log_group_name = "/ecs/${var.environment}/backend-api"
  environment    = var.environment
  aws_region     = var.aws_region

  # Resources to monitor
  ecs_cluster_name        = module.ecs.cluster_name
  ecs_service_name        = module.ecs.service_name
  rds_instance_id         = module.rds.instance_id
  elasticache_cluster_id  = module.elasticache.cluster_id
  s3_bucket_name          = module.s3.bucket_name

  # Alarm configuration
  alarm_email              = var.alarm_email
  monthly_cost_threshold   = var.monthly_cost_threshold
  s3_storage_threshold_gb  = var.s3_storage_threshold_gb
}

# ECS - Container Orchestration
module "ecs" {
  source = "./modules/ecs"

  cluster_name = var.ecs_cluster_name
  service_name = var.ecs_service_name
  task_family  = var.ecs_task_family

  ecr_repository_url  = module.ecr.repository_url
  container_image_tag = var.container_image_tag

  task_cpu      = var.task_cpu
  task_memory   = var.task_memory
  desired_count = var.desired_count

  vpc_id            = data.aws_vpc.default.id
  subnet_ids        = local.public_subnet_ids # Use verified public subnets with IGW routes
  security_group_id = module.security.ecs_security_group_id

  task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  task_role_arn           = module.iam.ecs_task_role_arn

  log_group_name = module.cloudwatch.log_group_name
  aws_region     = var.aws_region

  # Load balancer integration
  target_group_arn = module.alb.target_group_arn

  # Environment variables for the container
  environment_variables = {
    APP_ENV             = var.environment
    LOG_LEVEL           = "INFO"
    DATABASE_URL        = "postgresql://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}"
    REDIS_URL           = "redis://${module.elasticache.endpoint}:6379/0"
    S3_BUCKET           = module.s3.bucket_name
    AWS_REGION          = var.aws_region
    CORS_ORIGINS        = "${var.cors_origins},https://${module.cloudfront.cloudfront_domain_name}"
    REPLICATE_API_TOKEN = var.replicate_api_token
    OPENAI_API_KEY      = var.openai_api_key
  }

  environment = var.environment
}

# CloudFront - CDN with HTTPS
module "cloudfront" {
  source = "./modules/cloudfront"

  project_name      = "ai-video"
  environment       = var.environment
  alb_dns_name      = module.alb.alb_dns_name
  cloudfront_secret = var.cloudfront_secret
}
