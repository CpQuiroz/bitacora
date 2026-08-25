# ============================================================
# BITÁCORA — Infraestructura como código (Terraform) para GCP
# Esto NO se ejecuta a mano en la consola: se aplica desde el
# pipeline de GitHub Actions, así toda la infra queda versionada
# ============================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  # Estado remoto: nunca guardar el .tfstate local ni en el repo
  backend "gcs" {
    bucket = "bitacora-terraform-state"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ------------------------------------------------------------
# BASE DE DATOS
# ------------------------------------------------------------
resource "google_sql_database_instance" "bitacora_db" {
  name             = "bitacora-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-custom-1-3840" # ajustar según carga real
    ip_configuration {
      ipv4_enabled    = false # sin IP pública — solo acceso privado
      private_network = google_compute_network.bitacora_vpc.id
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "bitacora" {
  name     = "bitacora"
  instance = google_sql_database_instance.bitacora_db.name
}

# ------------------------------------------------------------
# RED PRIVADA (para que Cloud SQL no tenga IP pública)
# ------------------------------------------------------------
resource "google_compute_network" "bitacora_vpc" {
  name                    = "bitacora-vpc"
  auto_create_subnetworks = true
}

# ------------------------------------------------------------
# STORAGE — fotos de órdenes de servicio
# ------------------------------------------------------------
resource "google_storage_bucket" "fotos_trabajos" {
  name                        = "${var.project_id}-fotos-trabajos"
  location                    = var.region
  uniform_bucket_level_access = true # sin ACLs públicas por objeto

  lifecycle_rule {
    condition { age = 365 }
    action { type = "SetStorageClass" storage_class = "COLDLINE" }
  }
}

# ------------------------------------------------------------
# SERVICE ACCOUNTS con permisos mínimos
# ------------------------------------------------------------
resource "google_service_account" "backend_sa" {
  account_id   = "bitacora-backend"
  display_name = "Bitácora - backend Cloud Run"
}

resource "google_service_account" "ia_sa" {
  account_id   = "bitacora-ia"
  display_name = "Bitácora - análisis de IA (fotos/informes)"
}

# ------------------------------------------------------------
# BACKEND — Cloud Run
# ------------------------------------------------------------
resource "google_cloud_run_v2_service" "backend" {
  name     = "bitacora-backend"
  location = var.region

  template {
    service_account = google_service_account.backend_sa.email
    containers {
      image = var.backend_image # se actualiza en cada deploy del pipeline
      env {
        name  = "DB_INSTANCE"
        value = google_sql_database_instance.bitacora_db.connection_name
      }
    }
  }
}

# ------------------------------------------------------------
# SECRETOS (los valores reales se cargan aparte, nunca aquí)
# ------------------------------------------------------------
resource "google_secret_manager_secret" "claude_api_key" {
  secret_id = "claude-api-key"
  replication { auto {} }
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "bitacora-db-password"
  replication { auto {} }
}

# ------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------
variable "project_id" { type = string }
variable "region"     { type = string, default = "us-central1" }
variable "backend_image" { type = string }
