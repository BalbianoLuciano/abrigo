terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # El estado vive en un bucket creado a mano antes del primer apply (ver README).
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}
