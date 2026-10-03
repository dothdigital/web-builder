terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
provider "aws" { region = var.region }
data "aws_caller_identity" "current" {}
variable "region" { type = string }
variable "bucket_name" { type = string }
variable "platform_role_name" {
  type = string
  description = "Existing EC2/ECS application role. Customers never receive this role."
}
resource "aws_s3_bucket" "published" {
  bucket = var.bucket_name
  force_destroy = false
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_public_access_block" "published" {
  bucket = aws_s3_bucket.published.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "published" {
  bucket = aws_s3_bucket.published.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}
resource "aws_s3_bucket_versioning" "published" {
  bucket = aws_s3_bucket.published.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_cloudfront_origin_access_control" "published" {
  name = "webtummy-published-sites"
  description = "CloudFront access to private customer HTML releases"
  origin_access_control_origin_type = "s3"
  signing_behavior = "always"
  signing_protocol = "sigv4"
}
resource "aws_s3_bucket_policy" "published" {
  bucket = aws_s3_bucket.published.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Sid = "CloudFrontReadOnly", Effect = "Allow",
    Principal = { Service = "cloudfront.amazonaws.com" },
    Action = "s3:GetObject", Resource = "${aws_s3_bucket.published.arn}/sites/*",
    Condition = { StringLike = { "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*" } }
  }] })
}
resource "aws_iam_role_policy" "publisher" {
  name = "webtummy-static-publisher"
  role = var.platform_role_name
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.published.arn}/sites/*" },
    { Effect = "Allow", Action = ["cloudfront:CreateDistribution", "cloudfront:ListDistributions", "cloudfront:GetDistribution", "cloudfront:GetDistributionConfig", "cloudfront:UpdateDistribution", "cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:CreateFunction", "cloudfront:DescribeFunction", "cloudfront:UpdateFunction", "cloudfront:PublishFunction", "cloudfront:DeleteFunction"], Resource = "*" },
    { Effect = "Allow", Action = ["acm:RequestCertificate", "acm:DescribeCertificate", "acm:AddTagsToCertificate"], Resource = "*", Condition = { StringEquals = { "aws:RequestedRegion" = "us-east-1" } } }
  ] })
}
output "hosting_bucket" { value = aws_s3_bucket.published.id }
output "hosting_region" { value = var.region }
output "hosting_oac_id" { value = aws_cloudfront_origin_access_control.published.id }
