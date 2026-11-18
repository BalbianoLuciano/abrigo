# ─── Identidades con permisos mínimos ───
resource "google_service_account" "api" {
  account_id   = "abrigo-api"
  display_name = "Abrigo API y worker"
}

resource "google_secret_manager_secret_iam_member" "api" {
  for_each  = google_secret_manager_secret.s
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# Solo puede DESCIFRAR con la clave de mensajes (no cifrar claves nuevas ni administrarla).
resource "google_kms_crypto_key_iam_member" "api_decrypt" {
  crypto_key_id = google_kms_crypto_key.messages.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

locals {
  plain_env = {
    NODE_ENV                    = "production"
    PUBLIC_APP_URL              = "https://${var.app_domain}"
    API_URL                     = "https://${var.api_domain}"
    MESSAGE_KEY_PROVIDER        = "gcp-kms"
    KMS_KEY_NAME                = google_kms_crypto_key.messages.id
    MESSAGE_KEY_CURRENT_VERSION = "1"
    EMAIL_FROM                  = var.email_from
    VAPID_SUBJECT               = "mailto:hola@${var.app_domain}"
  }
}

# Contenedor común a API, worker y job de migraciones.
locals {
  vpc_access = {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.run.id
  }
}

resource "google_cloud_run_v2_service" "api" {
  name                = "abrigo-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  deletion_protection = true

  template {
    service_account                  = google_service_account.api.email
    max_instance_request_concurrency = 200
    timeout                          = "3600s" # conexiones WebSocket largas
    session_affinity                 = true

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = local.vpc_access.network
        subnetwork = local.vpc_access.subnetwork
      }
    }

    containers {
      image   = var.image
      command = ["node", "dist/main.js"]
      ports {
        container_port = 8080
      }
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      startup_probe {
        http_get {
          path = "/health"
        }
      }
      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = toset(local.all_secrets)
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

# El worker consume BullMQ: siempre prendido y sin estrangular CPU.
resource "google_cloud_run_v2_service" "worker" {
  name                = "abrigo-worker"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true

  template {
    service_account = google_service_account.api.email
    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }
    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = local.vpc_access.network
        subnetwork = local.vpc_access.subnetwork
      }
    }
    containers {
      image   = var.image
      command = ["node", "dist/worker.js"]
      resources {
        limits            = { cpu = "1", memory = "512Mi" }
        cpu_idle          = false
        startup_cpu_boost = true
      }
      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = toset(local.all_secrets)
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_job" "migrate" {
  name                = "abrigo-migrate"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = google_service_account.api.email
      max_retries     = 0
      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = local.vpc_access.network
          subnetwork = local.vpc_access.subnetwork
        }
      }
      containers {
        image   = var.image
        command = ["node", "node_modules/@abrigo/db/dist/migrate-cli.js"]
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s["DATABASE_URL"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

# El balanceador invoca la API; nadie más.
resource "google_cloud_run_v2_service_iam_member" "api_public_via_lb" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
