# ─── PostgreSQL 16 + PostGIS (Cloud SQL, IP privada, backups y PITR) ───
resource "google_sql_database_instance" "main" {
  name             = "abrigo-pg16"
  database_version = "POSTGRES_16"
  region           = var.region
  depends_on       = [google_service_networking_connection.private]

  settings {
    tier              = var.db_tier
    availability_type = "REGIONAL"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "06:00"
      backup_retention_settings {
        retained_backups = 14
      }
    }

    # Sin contenido de consultas en los logs (pueden incluir parámetros).
    database_flags {
      name  = "log_min_duration_statement"
      value = "-1"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = false
      record_client_address   = false
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "abrigo" {
  name     = "abrigo"
  instance = google_sql_database_instance.main.name
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  name     = "abrigo"
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}

# ─── Redis (Memorystore): BullMQ, pub/sub de Socket.IO, límites ───
resource "google_redis_instance" "main" {
  name                    = "abrigo"
  tier                    = "STANDARD_HA"
  memory_size_gb          = var.redis_memory_gb
  region                  = var.region
  redis_version           = "REDIS_7_2"
  authorized_network      = google_compute_network.main.id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  auth_enabled            = true
  # BullMQ necesita noeviction.
  redis_configs = {
    maxmemory-policy = "noeviction"
  }
  depends_on = [google_service_networking_connection.private]
}

# ─── KMS: clave que envuelve las claves de datos de los mensajes ───
resource "google_kms_key_ring" "main" {
  name       = "abrigo"
  location   = var.region
  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "messages" {
  name            = "messages"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s" # 90 días
  purpose         = "ENCRYPT_DECRYPT"
  lifecycle {
    prevent_destroy = true
  }
}
